import { ref, watch } from 'vue';
import { ensureAnonymousSession, isSupabaseConfigured, supabase } from '../lib/supabase';
import { useRealtimeSync } from './useRealtimeSync';
import { getErrorMessage } from '../utils/error';
import { useBentoStore } from './useBentoStore';
import type { AppSettings, BentoLocation, DailyRecord } from '../types';

const isSyncing = ref(false);
const syncLog = ref('');
const lastSyncedAt = ref('');

let lastUserId = '';
let autoPushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;
let pendingPush = false;
let isApplyingCloud = false;

// ---- Realtime 多端实时同步（复用 useRealtimeSync 单例）----
const { status: realtimeStatus, subscribe: subscribeRealtime, unsubscribe: teardownRealtime } = useRealtimeSync();
const REALTIME_TABLES = [
  { table: 'user_records' },
  { table: 'user_locations' },
  { table: 'user_settings' },
  { table: 'user_deletions' },
];

// 回声抑制：云端行不新于本地（严格大于才算新）则视为自己写入的回声，不触发拉取。
// 用严格 `>` 而非 `>=`：同毫秒但内容不同（极端并发）时也会触发一次幂等拉取，保证收敛。
function isSelfEcho(table: string, row: any, eventType: string): boolean {
  if (eventType === 'DELETE' || !row) return false;
  if (typeof row.updated_at_ms !== 'number') return false;
  const { records, locations, settings } = useBentoStore();
  if (table === 'user_records') {
    const local = records.value.find(item => item.id === row.id);
    return !!local && (local.updatedAt ?? 0) >= row.updated_at_ms;
  }
  if (table === 'user_locations') {
    const local = locations.value.find(item => item.id === row.id);
    return !!local && (local.updatedAt ?? 0) >= row.updated_at_ms;
  }
  if (table === 'user_settings') {
    return (settings.value.updatedAt ?? 0) >= row.updated_at_ms;
  }
  return false;
}

// 收到 Realtime 事件批（已由 useRealtimeSync 防抖累积为数组）→ 触发一次云端合并拉取
function handleRealtimeChange(payloads: any[]) {
  if (isApplyingCloud) return; // 正在应用云端合并时忽略
  // 任一事件非自身回声（真实远端变更）即拉取一次（全量合并，一次足够）
  const hasRealChange = payloads.some(p => !isSelfEcho(p.table, p.new, p.eventType));
  if (!hasRealChange) return;
  pullFromCloud(true);
}

// 订阅当前用户 4 张同步表的变更，实现多端真实时刷新（委托 useRealtimeSync 管理连接与状态）
function setupRealtime(userId: string) {
  if (!supabase || !userId) return;
  subscribeRealtime({
    userId,
    tables: REALTIME_TABLES,
    onChange: handleRealtimeChange,
    debounceMs: 400,
  });
}

interface SyncResult {
  success: boolean;
  message: string;
}

function timeNow(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function errorMessage(error: unknown): string {
  return getErrorMessage(error) || '未知错误';
}

function syncConfig(): { enabled: boolean; autoSync: boolean } {
  const { settings } = useBentoStore();
  const cfg = settings.value.personalSyncConfig;
  return {
    enabled: cfg?.enabled !== false && isSupabaseConfigured,
    autoSync: cfg?.autoSync === true,
  };
}

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  try {
    await ensureAnonymousSession();
    const { data: after } = await supabase.auth.getSession();
    return after.session?.user?.id || null;
  } catch (e) {
    return null;
  }
}

// ---- 时间戳：旧数据缺失 updatedAt 时用可复现的时间兜底，避免误判为“最新” ----
function recordTs(r: DailyRecord): number {
  if (typeof r.updatedAt === 'number' && r.updatedAt > 0) return r.updatedAt;
  const t = Date.parse(`${r.date}T${r.drawnAt || '00:00:00'}`);
  return Number.isNaN(t) ? 0 : t;
}

function locationTs(l: BentoLocation): number {
  return typeof l.updatedAt === 'number' && l.updatedAt > 0 ? l.updatedAt : (l.createdAt || 0);
}

// ---- 行映射 ----
function toRecordRow(r: DailyRecord, userId: string) {
  return {
    user_id: userId,
    id: r.id,
    date: r.date,
    meal_category: r.mealCategory || null,
    status: r.status || 'confirmed',
    location_id: r.locationId || null,
    location_name: r.locationName || null,
    emoji: r.emoji || null,
    tags: r.tags || [],
    drawn_at: r.drawnAt || null,
    note: r.note || null,
    cost: typeof r.cost === 'number' ? r.cost : null,
    address: r.address || null,
    map_url: r.mapUrl || null,
    updated_at_ms: recordTs(r),
  };
}

function fromRecordRow(row: any): DailyRecord {
  return {
    id: row.id,
    date: row.date,
    mealCategory: row.meal_category || undefined,
    status: row.status || 'confirmed',
    locationId: row.location_id || '',
    locationName: row.location_name || '',
    emoji: row.emoji || '',
    tags: row.tags || [],
    drawnAt: row.drawn_at || '',
    note: row.note || undefined,
    cost: row.cost != null ? Number(row.cost) : undefined,
    address: row.address || undefined,
    mapUrl: row.map_url || undefined,
    updatedAt: row.updated_at_ms || undefined,
  };
}

function toLocationRow(l: BentoLocation, userId: string) {
  return {
    user_id: userId,
    id: l.id,
    name: l.name,
    emoji: l.emoji || '🍚',
    tags: l.tags || [],
    price_range: l.priceRange || '',
    recommended_dish: l.recommendedDish || null,
    weight: l.weight || 1,
    is_drawn: l.isDrawn === true,
    visible: l.visible !== false,
    meal_categories: l.mealCategories || null,
    address: l.address || null,
    map_url: l.mapUrl || null,
    created_at_ms: l.createdAt || 0,
    updated_at_ms: locationTs(l),
  };
}

function fromLocationRow(row: any): BentoLocation {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || '',
    tags: row.tags || [],
    priceRange: row.price_range || '',
    recommendedDish: row.recommended_dish || undefined,
    weight: row.weight || 1,
    isDrawn: row.is_drawn === true,
    createdAt: row.created_at_ms || 0,
    mealCategories: row.meal_categories || undefined,
    address: row.address || undefined,
    mapUrl: row.map_url || undefined,
    visible: row.visible !== false,
    updatedAt: row.updated_at_ms || undefined,
  };
}

// 设备级设置（密码、同步配置、当前模式）不进云端，避免跨设备误覆盖
function toSettingsPayload(s: AppSettings) {
  const { adminPassword, personalSyncConfig, cloudSync, activeMode, ...rest } = s;
  return { ...rest, updatedAt: s.updatedAt || 0 };
}

function fromSettingsPayload(raw: any): Partial<AppSettings> {
  const { adminPassword, personalSyncConfig, cloudSync, activeMode, ...rest } = raw || {};
  return rest;
}

// ---- 合并策略：按 id 去重，取 updatedAt 更新的一方；只增不删 ----
function mergeRecords(local: DailyRecord[], cloud: DailyRecord[]): DailyRecord[] {
  const map = new Map<string, DailyRecord>();
  for (const r of local) map.set(r.id, r);
  for (const c of cloud) {
    const existing = map.get(c.id);
    if (!existing || (c.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      map.set(c.id, c);
    }
  }
  return Array.from(map.values());
}

function mergeLocations(local: BentoLocation[], cloud: BentoLocation[]): BentoLocation[] {
  const map = new Map<string, BentoLocation>();
  for (const l of local) map.set(l.id, l);
  for (const c of cloud) {
    const existing = map.get(c.id);
    if (!existing || (c.updatedAt ?? 0) >= (existing.updatedAt ?? 0)) {
      map.set(c.id, c);
    }
  }
  return Array.from(map.values());
}

async function pushToCloud(silent = false): Promise<SyncResult> {
  const cfg = syncConfig();
  if (!cfg.enabled) return { success: false, message: '个人云同步未开启' };
  if (!supabase) return { success: false, message: '未配置 Supabase' };

  const userId = await getUserId();
  if (!userId) return { success: false, message: '未获取到登录身份' };

  if (!silent) {
    isSyncing.value = true;
    syncLog.value = '正在推送数据到云端...';
  }

  try {
    const { locations, records, settings, tombstones } = useBentoStore();

    // 读取云端当前时间戳，只推送“本地更新”的数据，避免旧数据覆盖新数据
    const [recCloud, locCloud, setCloud] = await Promise.all([
      supabase.from('user_records').select('id, updated_at_ms').eq('user_id', userId),
      supabase.from('user_locations').select('id, updated_at_ms').eq('user_id', userId),
      supabase.from('user_settings').select('updated_at_ms').eq('user_id', userId).maybeSingle(),
    ]);
    if (recCloud.error) throw recCloud.error;
    if (locCloud.error) throw locCloud.error;
    if (setCloud.error) throw setCloud.error;

    const cloudRecTs = new Map((recCloud.data || []).map((r: any) => [r.id, r.updated_at_ms || 0]));
    const cloudLocTs = new Map((locCloud.data || []).map((l: any) => [l.id, l.updated_at_ms || 0]));

    const recRows = records.value.map(r => toRecordRow(r, userId)).filter(r => (cloudRecTs.get(r.id) ?? -1) < r.updated_at_ms);
    const locRows = locations.value.map(l => toLocationRow(l, userId)).filter(l => (cloudLocTs.get(l.id) ?? -1) < l.updated_at_ms);

    // 本地已删除但云端还存在的 id -> 推墓碑（跨设备删除传播）
    const liveIds = new Set([...records.value.map(r => r.id), ...locations.value.map(l => l.id)]);
    const delRows = tombstones.value
      .filter(t => !liveIds.has(t.id))
      .map(t => ({ user_id: userId, kind: t.kind, id: t.id, deleted_at_ms: t.deletedAt }));

    const localSettingsTs = settings.value.updatedAt || 0;
    const cloudSettingsTs = setCloud.data?.updated_at_ms || 0;
    // 严格大于：避免“云端已等于本地”时反复 upsert，产生 Realtime 回声死循环
    const pushSettings = localSettingsTs > cloudSettingsTs;

    const batch: PromiseLike<any>[] = [];
    if (recRows.length > 0) {
      batch.push(supabase.from('user_records').upsert(recRows, { onConflict: 'user_id,id' }));
    }
    if (locRows.length > 0) {
      batch.push(supabase.from('user_locations').upsert(locRows, { onConflict: 'user_id,id' }));
    }
    if (delRows.length > 0) {
      batch.push(supabase.from('user_deletions').upsert(delRows, { onConflict: 'user_id,kind,id' }));
    }
    if (pushSettings) {
      batch.push(supabase.from('user_settings').upsert({
        user_id: userId,
        settings: toSettingsPayload(settings.value),
        updated_at_ms: localSettingsTs || Date.now(),
      }, { onConflict: 'user_id' }));
    }

    const results = await Promise.all(batch);
    const firstError = results.find(r => r && r.error);
    if (firstError) throw firstError.error;

    lastSyncedAt.value = timeNow();
    if (!silent) syncLog.value = `已成功推送到云端 (${lastSyncedAt.value})`;
    return { success: true, message: '成功推送数据到云端' };
  } catch (error) {
    const message = errorMessage(error);
    if (!silent) syncLog.value = `云端推送失败: ${message}`;
    return { success: false, message: `同步推送失败: ${message}` };
  } finally {
    isSyncing.value = false;
  }
}

async function pullFromCloud(silent = false): Promise<SyncResult> {
  const cfg = syncConfig();
  if (!cfg.enabled) return { success: false, message: '个人云同步未开启' };
  if (!supabase) return { success: false, message: '未配置 Supabase' };

  const userId = await getUserId();
  if (!userId) return { success: false, message: '未获取到登录身份' };

  if (!silent) {
    isSyncing.value = true;
    syncLog.value = '正在从云端拉取数据...';
  }

  try {
    const { locations, records, settings, addTombstone } = useBentoStore();

    const [recRes, locRes, delRes, setRes] = await Promise.all([
      supabase.from('user_records').select('*').eq('user_id', userId),
      supabase.from('user_locations').select('*').eq('user_id', userId),
      supabase.from('user_deletions').select('*').eq('user_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (recRes.error) throw recRes.error;
    if (locRes.error) throw locRes.error;
    if (delRes.error) throw delRes.error;
    if (setRes.error) throw setRes.error;

    const cloudRecords = (recRes.data || []).map(fromRecordRow);
    const cloudLocations = (locRes.data || []).map(fromLocationRow);
    const deletions = (delRes.data || []) as { kind: 'record' | 'location'; id: string; deleted_at_ms: number }[];

    isApplyingCloud = true;
    try {
      let mergedRecords = mergeRecords(records.value, cloudRecords);
      let mergedLocations = mergeLocations(locations.value, cloudLocations);

      // 应用删除墓碑：云端删除比本地版本新时，本地同步删除
      for (const d of deletions) {
        if (d.kind === 'record') {
          const existing = mergedRecords.find(r => r.id === d.id);
          if (existing && (existing.updatedAt ?? 0) < d.deleted_at_ms) {
            mergedRecords = mergedRecords.filter(r => r.id !== d.id);
            addTombstone('record', d.id);
          }
        } else if (d.kind === 'location') {
          const existing = mergedLocations.find(l => l.id === d.id);
          if (existing && (existing.updatedAt ?? 0) < d.deleted_at_ms) {
            mergedLocations = mergedLocations.filter(l => l.id !== d.id);
            addTombstone('location', d.id);
          }
        }
      }

      records.value = mergedRecords;
      locations.value = mergedLocations;

      const cloudSettings = setRes.data?.settings ? fromSettingsPayload(setRes.data.settings) : null;
      if (cloudSettings && Object.keys(cloudSettings).length > 0) {
        const localTs = settings.value.updatedAt || 0;
        const cloudTs = typeof cloudSettings.updatedAt === 'number'
          ? cloudSettings.updatedAt
          : (setRes.data?.updated_at_ms || 0);
        if (cloudTs > localTs) {
          settings.value = { ...settings.value, ...cloudSettings, updatedAt: cloudTs };
        }
      }
    } finally {
      isApplyingCloud = false;
    }

    // 把合并后的并集写回云端，保证多台设备都收敛到同一份数据
    await pushToCloud(true);

    lastSyncedAt.value = timeNow();
    if (!silent) syncLog.value = `已从云端同步并合并 (${lastSyncedAt.value})`;
    return { success: true, message: '已从云端同步并合并，本地数据不会丢失' };
  } catch (error) {
    const message = errorMessage(error);
    if (!silent) syncLog.value = `从云端拉取失败: ${message}`;
    return { success: false, message: `拉取失败: ${message}` };
  } finally {
    isSyncing.value = false;
  }
}

function scheduleAutoPush() {
  if (autoPushTimer) clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(() => {
    autoPushTimer = null;
    if (pushInFlight) {
      pendingPush = true;
      return;
    }
    pushInFlight = true;
    pushToCloud(true).finally(() => {
      pushInFlight = false;
      if (pendingPush) {
        pendingPush = false;
        scheduleAutoPush();
      }
    });
  }, 800);
}

function setupAutoSync() {
  const { locations, records, settings, tombstones } = useBentoStore();
  watch([locations, records, settings, tombstones], () => {
    if (isApplyingCloud) return;
    if (!syncConfig().autoSync) return;
    scheduleAutoPush();
  }, { deep: true });
}

function setupAuthListener() {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((event, session) => {
    const uid = session?.user?.id || '';
    const { setPersonalStorageNamespace } = useBentoStore();
    if (event === 'SIGNED_OUT') {
      lastUserId = '';
      teardownRealtime();
      setPersonalStorageNamespace(null);
      return;
    }
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && uid && uid !== lastUserId) {
      lastUserId = uid;
      setPersonalStorageNamespace(uid);
      // 等账号数据分区切换完成后，再做一次云端合并 + 建立实时订阅
      setTimeout(() => {
        // 守卫：200ms 内已登出或切换账号则放弃过期订阅
        if (lastUserId !== uid) return;
        pullFromCloud(true);
        setupRealtime(uid);
      }, 200);
    }
  });
}

/**
 * 应用启动时调用：切换账号数据分区 + 首次云端合并 + 开启自动同步
 */
async function initializePersonalSync() {
  if (!isSupabaseConfigured || !supabase) return;
  setupAutoSync();
  setupAuthListener();
  const userId = await getUserId();
  if (userId && userId !== lastUserId) {
    lastUserId = userId;
    const { setPersonalStorageNamespace } = useBentoStore();
    setPersonalStorageNamespace(userId);
    await pullFromCloud(true);
    setupRealtime(userId);
  }
}

export function useCloudSync() {
  return {
    isSyncing,
    syncLog,
    lastSyncedAt,
    realtimeStatus,
    pushToCloud,
    pullFromCloud,
    initializePersonalSync,
    setupRealtime,
    teardownRealtime,
  };
}
