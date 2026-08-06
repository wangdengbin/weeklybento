import { ref, computed, watch } from 'vue';
import { getDefaultMealCategoryByTime, getMondayDateString, getTodayDateString } from '../utils/date';
import type { AppSettings, BentoLocation, CloudSyncConfig, DailyRecord, MealCategory, RecordStatus, SyncTombstone } from '../types';

const STORAGE_KEY_LOCATIONS = 'weekly_bento_locations_v3';
const STORAGE_KEY_RECORDS = 'weekly_bento_records_v1';
const STORAGE_KEY_SETTINGS = 'weekly_bento_settings_v1';
const STORAGE_KEY_TOMBSTONES = 'weekly_bento_tombstones_v1';
const LEGACY_CLAIM_KEY = 'weekly_bento_legacy_claimed_by';

// 按登录用户隔离本地存储：每个 user_id 一套数据，避免多账号数据串台
let storageNamespace = '';

function nsKey(key: string): string {
  return storageNamespace ? `${key}__${storageNamespace}` : key;
}

// 旧版单用户 localStorage 数据只会迁移给第一个在该设备上同步的账号，
// 之后登录的其他账号不会继承这些数据（避免不同账号数据混在一起）。
function seedNamespaceFromLegacy(userId: string) {
  const claimed = localStorage.getItem(LEGACY_CLAIM_KEY);
  if (claimed && claimed !== userId) return;
  const keys = [STORAGE_KEY_LOCATIONS, STORAGE_KEY_RECORDS, STORAGE_KEY_SETTINGS, STORAGE_KEY_TOMBSTONES];
  let copied = false;
  for (const key of keys) {
    if (localStorage.getItem(nsKey(key)) === null) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        localStorage.setItem(nsKey(key), raw);
        copied = true;
      }
    }
  }
  if (copied) localStorage.setItem(LEGACY_CLAIM_KEY, userId);
}

// 默认池以常见用餐场景为主；已有本地数据不会被自动覆盖。
const DEFAULT_LOCATIONS: BentoLocation[] = [
  { id: '1', name: '包子豆浆', emoji: '🥟', tags: ['早餐', '快捷', '实惠'], priceRange: '￥6-12', recommendedDish: '鲜肉包+无糖豆浆', weight: 1, isDrawn: false, createdAt: Date.now(), mealCategories: ['breakfast'] },
  { id: '2', name: '粥铺早餐', emoji: '🥣', tags: ['早餐', '热乎', '清淡'], priceRange: '￥10-18', recommendedDish: '皮蛋瘦肉粥+鸡蛋', weight: 1, isDrawn: false, createdAt: Date.now() + 1, mealCategories: ['breakfast', 'night'] },
  { id: '3', name: '肠粉 / 汤粉面', emoji: '🍜', tags: ['早餐', '现做', '饱腹'], priceRange: '￥10-20', recommendedDish: '鸡蛋瘦肉肠粉', weight: 1, isDrawn: false, createdAt: Date.now() + 2, mealCategories: ['breakfast'] },
  { id: '4', name: '麦当劳 / 肯德基早餐', emoji: '🥪', tags: ['早餐', '连锁', '快捷'], priceRange: '￥12-25', recommendedDish: '早餐堡+咖啡', weight: 1, isDrawn: false, createdAt: Date.now() + 3, mealCategories: ['breakfast'] },
  { id: '5', name: '便利店早餐', emoji: '🍙', tags: ['早餐', '便利', '省时'], priceRange: '￥8-18', recommendedDish: '饭团+牛奶', weight: 1, isDrawn: false, createdAt: Date.now() + 4, mealCategories: ['breakfast'] },
  { id: '6', name: '隆江猪脚饭 / 烧腊饭', emoji: '🍱', tags: ['米饭', '快餐', '肉食'], priceRange: '￥18-30', recommendedDish: '双拼饭加青菜', weight: 1, isDrawn: false, createdAt: Date.now() + 5, mealCategories: ['lunch', 'dinner'] },
  { id: '7', name: '黄焖鸡米饭', emoji: '🍗', tags: ['米饭', '经典', '下饭'], priceRange: '￥18-28', recommendedDish: '黄焖鸡+腐竹', weight: 1, isDrawn: false, createdAt: Date.now() + 6, mealCategories: ['lunch', 'dinner'] },
  { id: '8', name: '自选快餐 / 称重餐', emoji: '🥡', tags: ['自选', '快餐', '均衡'], priceRange: '￥15-30', recommendedDish: '两荤一素', weight: 1, isDrawn: false, createdAt: Date.now() + 7, mealCategories: ['lunch', 'dinner'] },
  { id: '9', name: '兰州拉面 / 牛肉面', emoji: '🍜', tags: ['面食', '热乎', '实惠'], priceRange: '￥15-28', recommendedDish: '牛肉面加蛋', weight: 1, isDrawn: false, createdAt: Date.now() + 8, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '10', name: '麻辣烫 / 冒菜', emoji: '🍲', tags: ['自选', '麻辣', '丰富'], priceRange: '￥20-38', recommendedDish: '骨汤微辣+芝麻酱', weight: 1, isDrawn: false, createdAt: Date.now() + 9, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '11', name: '麻辣香锅', emoji: '🥘', tags: ['重口味', '香辣', '聚餐'], priceRange: '￥30-55', recommendedDish: '牛肉+午餐肉+蔬菜', weight: 1, isDrawn: false, createdAt: Date.now() + 10, mealCategories: ['lunch', 'dinner'] },
  { id: '12', name: '酸菜鱼 / 水煮鱼', emoji: '🐟', tags: ['鱼肉', '下饭', '聚餐'], priceRange: '￥30-60', recommendedDish: '无骨酸菜鱼配米饭', weight: 1, isDrawn: false, createdAt: Date.now() + 11, mealCategories: ['lunch', 'dinner'] },
  { id: '13', name: '潮汕牛肉粿条', emoji: '🍲', tags: ['汤粉', '鲜美', '清淡'], priceRange: '￥20-35', recommendedDish: '牛肉汤粿条', weight: 1, isDrawn: false, createdAt: Date.now() + 12, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '14', name: '轻食沙拉 / 健身餐', emoji: '🥗', tags: ['轻食', '健康', '低负担'], priceRange: '￥25-42', recommendedDish: '鸡胸肉谷物碗', weight: 1, isDrawn: false, createdAt: Date.now() + 13, mealCategories: ['lunch', 'dinner'] },
  { id: '15', name: '日式拉面 / 乌冬面', emoji: '🍜', tags: ['日料', '面食', '热乎'], priceRange: '￥25-45', recommendedDish: '豚骨拉面', weight: 1, isDrawn: false, createdAt: Date.now() + 14, mealCategories: ['lunch', 'dinner'] },
  { id: '16', name: '汉堡 / 炸鸡', emoji: '🍔', tags: ['快餐', '解馋', '高能量'], priceRange: '￥20-45', recommendedDish: '牛肉堡套餐', weight: 1, isDrawn: false, createdAt: Date.now() + 15, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '17', name: '披萨 / 意面', emoji: '🍕', tags: ['西餐', '聚餐', '休闲'], priceRange: '￥30-60', recommendedDish: '意面+小食拼盘', weight: 1, isDrawn: false, createdAt: Date.now() + 16, mealCategories: ['lunch', 'dinner'] },
  { id: '18', name: '茶饮店', emoji: '🧋', tags: ['奶茶', '饮品', '解压'], priceRange: '￥12-22', recommendedDish: '招牌奶茶少糖', weight: 1, isDrawn: false, createdAt: Date.now() + 17, mealCategories: ['tea'] },
  { id: '19', name: '咖啡店', emoji: '☕', tags: ['咖啡', '提神', '办公'], priceRange: '￥10-28', recommendedDish: '拿铁或美式', weight: 1, isDrawn: false, createdAt: Date.now() + 18, mealCategories: ['breakfast', 'tea'] },
  { id: '20', name: '鲜果茶 / 果汁', emoji: '🍹', tags: ['果茶', '清爽', '低负担'], priceRange: '￥12-24', recommendedDish: '鲜果茶少糖', weight: 1, isDrawn: false, createdAt: Date.now() + 19, mealCategories: ['tea'] },
  { id: '21', name: '面包甜点店', emoji: '🥐', tags: ['烘焙', '甜点', '下午茶'], priceRange: '￥12-30', recommendedDish: '可颂+小蛋糕', weight: 1, isDrawn: false, createdAt: Date.now() + 20, mealCategories: ['breakfast', 'tea'] },
  { id: '22', name: '糖水 / 豆花', emoji: '🍧', tags: ['甜品', '糖水', '休闲'], priceRange: '￥8-20', recommendedDish: '豆花或时令糖水', weight: 1, isDrawn: false, createdAt: Date.now() + 21, mealCategories: ['tea', 'night'] },
  { id: '23', name: '烧烤 / 串串', emoji: '🍢', tags: ['烧烤', '聚餐', '夜宵'], priceRange: '￥35-70', recommendedDish: '肉串+烤蔬菜', weight: 1, isDrawn: false, createdAt: Date.now() + 22, mealCategories: ['dinner', 'night'] },
  { id: '24', name: '砂锅粥 / 生滚粥', emoji: '🥣', tags: ['夜宵', '热乎', '清淡'], priceRange: '￥20-45', recommendedDish: '生滚肉片粥', weight: 1, isDrawn: false, createdAt: Date.now() + 23, mealCategories: ['dinner', 'night'] },
  { id: '25', name: '便利店关东煮 / 便当', emoji: '🍢', tags: ['夜宵', '便利', '快速'], priceRange: '￥12-25', recommendedDish: '关东煮+饭团', weight: 1, isDrawn: false, createdAt: Date.now() + 24, mealCategories: ['lunch', 'dinner', 'night'] },
];

function loadLocations(): BentoLocation[] {
  try {
    const data = localStorage.getItem(nsKey(STORAGE_KEY_LOCATIONS));
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 兼容旧数据：补齐 updatedAt，供云同步冲突合并使用
        return parsed.map((l: BentoLocation) => ({
          ...l,
          updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : (l.createdAt || 0),
        }));
      }
    }
  } catch (e) {}
  return DEFAULT_LOCATIONS;
}

function loadRecords(): DailyRecord[] {
  try {
    const data = localStorage.getItem(nsKey(STORAGE_KEY_RECORDS));
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // 兼容旧数据：补齐 mealCategory、status、updatedAt
        return parsed.map((r: DailyRecord) => {
          const base = {
            ...r,
            mealCategory: r.mealCategory || 'lunch',
            status: r.status || 'confirmed',
          };
          if (typeof base.updatedAt !== 'number') {
            const t = Date.parse(`${base.date}T${base.drawnAt || '00:00:00'}`);
            base.updatedAt = Number.isNaN(t) ? 0 : t;
          }
          return base;
        });
      }
    }
  } catch (e) {}
  return [];
}

function loadTombstones(): SyncTombstone[] {
  try {
    const data = localStorage.getItem(nsKey(STORAGE_KEY_TOMBSTONES));
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        // 清理超过 90 天的过期墓碑
        return parsed.filter((t: SyncTombstone) => now - (t.deletedAt || 0) < 90 * 24 * 3600 * 1000);
      }
    }
  } catch (e) {}
  return [];
}

function loadSettings(): AppSettings {
  const defaultSettings: AppSettings = {
    adminPassword: 'admin888',
    antiRepeatMode: 'round',
    weeklyNoRepeat: true,
    soundEnabled: true,
    activeMode: 'personal',
    enabledMealCategories: ['breakfast', 'lunch', 'tea', 'dinner', 'night'],
    personalSyncConfig: {
      enabled: true,
      provider: 'supabase',
      apiUrl: '',
      apiKey: '',
      autoSync: true,
    },
    updatedAt: 0,
  };
  try {
    const data = localStorage.getItem(nsKey(STORAGE_KEY_SETTINGS));
    if (data) {
      const parsed = JSON.parse(data);
      const merged = { ...defaultSettings, ...parsed };
      // 旧版 JSONBin 配置迁移为 Supabase 方案
      if (merged.personalSyncConfig && (merged.personalSyncConfig as CloudSyncConfig).provider === 'jsonbin') {
        merged.personalSyncConfig = { ...defaultSettings.personalSyncConfig! };
      }
      return merged;
    }
  } catch (e) {}
  return defaultSettings;
}

const locations = ref<BentoLocation[]>(loadLocations());
const records = ref<DailyRecord[]>(loadRecords());
const settings = ref<AppSettings>(loadSettings());
const tombstones = ref<SyncTombstone[]>(loadTombstones());
const selectedCategory = ref<MealCategory>(getDefaultMealCategoryByTime());

// 本地内存与缓存监听
watch(locations, (val) => {
  localStorage.setItem(nsKey(STORAGE_KEY_LOCATIONS), JSON.stringify(val));
}, { deep: true });

watch(records, (val) => {
  localStorage.setItem(nsKey(STORAGE_KEY_RECORDS), JSON.stringify(val));
}, { deep: true });

watch(settings, (val) => {
  localStorage.setItem(nsKey(STORAGE_KEY_SETTINGS), JSON.stringify(val));
}, { deep: true });

watch(tombstones, (val) => {
  localStorage.setItem(nsKey(STORAGE_KEY_TOMBSTONES), JSON.stringify(val));
}, { deep: true });

function addTombstone(kind: 'record' | 'location', id: string) {
  if (!tombstones.value.some(t => t.kind === kind && t.id === id)) {
    tombstones.value.push({ kind, id, deletedAt: Date.now() });
  }
}

// 切换当前账号对应的本地数据分区；userId 为空时回到旧版单用户数据
function setPersonalStorageNamespace(userId: string | null) {
  const target = userId ? `u_${userId}` : '';
  if (target === storageNamespace) return;
  storageNamespace = target;
  if (target && userId) seedNamespaceFromLegacy(userId);
  locations.value = loadLocations();
  records.value = loadRecords();
  settings.value = loadSettings();
  tombstones.value = loadTombstones();
}

import { MEAL_CATEGORIES } from '../types';
import { useTeamWorkspace } from './useTeamWorkspace';

export function useBentoStore() {
  const { teamPermissions, updateTeamPermissions } = useTeamWorkspace();

  // 根据当前激活模式过滤显示的 5 大餐池分类
  const visibleMealCategories = computed(() => {
    const enabledList = settings.value.activeMode === 'team'
      ? (teamPermissions.value?.enabledMealCategories || ['breakfast', 'lunch', 'tea', 'dinner', 'night'])
      : (settings.value.enabledMealCategories || ['breakfast', 'lunch', 'tea', 'dinner', 'night']);

    const set = new Set(enabledList);
    const result = MEAL_CATEGORIES.filter(c => set.has(c.key));
    return result.length > 0 ? result : MEAL_CATEGORIES;
  });

  watch(visibleMealCategories, (list) => {
    if (!list.some(c => c.key === selectedCategory.value) && list.length > 0) {
      selectedCategory.value = list[0].key;
    }
  }, { immediate: true });

  function updateEnabledMealCategories(cats: MealCategory[]) {
    if (settings.value.activeMode === 'team') {
      updateTeamPermissions({ enabledMealCategories: cats });
    } else {
      settings.value.enabledMealCategories = cats;
      settings.value.updatedAt = Date.now();
    }
  }

  // 根据餐池过滤地点
  function isLocationMatchingCategory(loc: BentoLocation, category: MealCategory): boolean {
    if (!loc.mealCategories || loc.mealCategories.length === 0) return true;
    return loc.mealCategories.includes(category);
  }

  // 仅获取已开启展示的地点 (visible !== false)
  const visibleLocations = computed(() => locations.value.filter(loc => loc.visible !== false));

  // 当前激活餐池的所有有效未抽地点
  const availablePool = computed(() => {
    const categoryPool = visibleLocations.value.filter(loc => isLocationMatchingCategory(loc, selectedCategory.value));
    const basePool = categoryPool.filter(loc => !loc.isDrawn);
    
    // 降级策略：当前餐池未抽池 -> 当前餐池全量池 -> 所有地点未抽池 -> 全量地点
    const poolToUse = basePool.length > 0 
      ? basePool 
      : (categoryPool.length > 0 ? categoryPool : visibleLocations.value.filter(loc => !loc.isDrawn));

    if (settings.value.weeklyNoRepeat !== false) {
      const mondayStr = getMondayDateString();
      const drawnIdsInWeek = new Set(
        records.value.filter(r => r.date >= mondayStr).map(r => r.locationId)
      );
      const weeklyPool = poolToUse.filter(loc => !drawnIdsInWeek.has(loc.id));
      return weeklyPool.length > 0 ? weeklyPool : poolToUse;
    }
    return poolToUse;
  });

  const drawnList = computed(() => visibleLocations.value.filter(loc => loc.isDrawn));
  const isPoolEmpty = computed(() => availablePool.value.length === 0);

  function setSelectedCategory(cat: MealCategory) {
    selectedCategory.value = cat;
  }

  function getRandomLocation(category?: MealCategory): BentoLocation | null {
    const targetCat = category || selectedCategory.value;
    const catLocations = visibleLocations.value.filter(loc => isLocationMatchingCategory(loc, targetCat));
    const basePool = catLocations.filter(loc => !loc.isDrawn);
    let pool = basePool.length > 0 ? basePool : (catLocations.length > 0 ? catLocations : visibleLocations.value);
    
    // 按周不重复：本周已打卡过的地点不再参与 Roll
    if (settings.value.weeklyNoRepeat !== false) {
      const mondayStr = getMondayDateString();
      const drawnIdsInWeek = new Set(
        records.value.filter(r => r.date >= mondayStr).map(r => r.locationId)
      );
      const weeklyPool = pool.filter(loc => !drawnIdsInWeek.has(loc.id));
      if (weeklyPool.length > 0) pool = weeklyPool;
    }

    if (pool.length === 0) return null;

    const totalWeight = pool.reduce((acc, cur) => acc + (cur.weight || 1), 0);
    let randomNum = Math.random() * totalWeight;

    for (const loc of pool) {
      if (randomNum < (loc.weight || 1)) return loc;
      randomNum -= (loc.weight || 1);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function markLocationAsDrawn(id: string) {
    const loc = locations.value.find(l => l.id === id);
    if (loc) {
      loc.isDrawn = true;
      loc.updatedAt = Date.now();
    }
  }

  function resetPool() {
    locations.value.forEach(l => {
      if (l.isDrawn) {
        l.isDrawn = false;
        l.updatedAt = Date.now();
      }
    });
  }

  // 添加或覆盖预选/确定打卡记录
  function addDailyRecord(
    loc: BentoLocation, 
    customDate?: string, 
    customNote?: string, 
    category?: MealCategory, 
    status: RecordStatus = 'planned', 
    cost?: number
  ): DailyRecord {
    const today = customDate || getTodayDateString();
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const targetCat = category || selectedCategory.value;

    // 查重：若同天同餐别已存在计划(planned)，则直接更新覆盖
    const existingIndex = records.value.findIndex(
      r => r.date === today && (r.mealCategory || 'lunch') === targetCat && r.status === 'planned'
    );

    const newRecord: DailyRecord = {
      id: (existingIndex >= 0) ? records.value[existingIndex].id : Date.now().toString() + Math.random().toString(36).substring(2, 5),
      date: today,
      mealCategory: targetCat,
      status: status,
      locationId: loc.id,
      locationName: loc.name,
      emoji: loc.emoji,
      tags: loc.tags || [],
      drawnAt: nowTime,
      note: customNote || loc.recommendedDish || '好味推荐！',
      cost: cost,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      records.value[existingIndex] = newRecord;
    } else {
      records.value.unshift(newRecord);
    }

    return newRecord;
  }

  // 直接补录/记一笔打卡
  function addDirectRecord(recordData: Omit<DailyRecord, 'id' | 'drawnAt'> & { drawnAt?: string }): DailyRecord {
    const nowTime = recordData.drawnAt || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const newRecord: DailyRecord = {
      ...recordData,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      drawnAt: nowTime,
      status: recordData.status || 'confirmed',
      mealCategory: recordData.mealCategory || selectedCategory.value,
      updatedAt: Date.now(),
    };
    records.value.unshift(newRecord);
    return newRecord;
  }

  // 将预选卡片转为确认打卡，并可录入金额与心得
  function confirmDailyRecord(id: string, cost?: number, note?: string) {
    const index = records.value.findIndex(r => r.id === id);
    if (index >= 0) {
      const target = records.value[index];
      records.value[index] = {
        ...target,
        status: 'confirmed',
        cost: cost !== undefined ? cost : target.cost,
        note: note !== undefined ? note : target.note,
        updatedAt: Date.now(),
      };
    }
  }

  function updateRecord(updatedRecord: DailyRecord) {
    const index = records.value.findIndex(r => r.id === updatedRecord.id);
    if (index >= 0) {
      records.value[index] = { ...updatedRecord, updatedAt: Date.now() };
    }
  }

  function deleteRecord(id: string) {
    addTombstone('record', id);
    records.value = records.value.filter(r => r.id !== id);
  }

  // 撤销删除：将已删除的记录恢复回列表头部（用于 Toast 撤销按钮）
  function restoreRecord(record: DailyRecord) {
    if (!record) return;
    if (!records.value.some(r => r.id === record.id)) {
      records.value.unshift({ ...record, updatedAt: Date.now() });
    }
  }

  function addLocation(locationData: Omit<BentoLocation, 'id' | 'isDrawn' | 'createdAt'>) {
    const newLoc: BentoLocation = {
      ...locationData,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      isDrawn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    locations.value.push(newLoc);
  }

  function updateLocation(updated: BentoLocation) {
    const index = locations.value.findIndex(l => l.id === updated.id);
    if (index >= 0) {
      locations.value[index] = { ...updated, updatedAt: Date.now() };
    }
  }

  function deleteLocation(id: string) {
    addTombstone('location', id);
    locations.value = locations.value.filter(l => l.id !== id);
  }

  function batchDeleteLocations(ids: string[]) {
    const set = new Set(ids);
    ids.forEach(id => addTombstone('location', id));
    locations.value = locations.value.filter(l => !set.has(l.id));
  }

  function restoreDefaultLocations() {
    const now = Date.now();
    locations.value = JSON.parse(JSON.stringify(DEFAULT_LOCATIONS)).map((l: BentoLocation) => ({
      ...l,
      updatedAt: now,
    }));
  }

  function exportDataJSON() {
    const data = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      locations: locations.value,
      records: records.value,
      settings: settings.value,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WeeklyBento_Backup_${getTodayDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importDataJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.locations && Array.isArray(parsed.locations)) {
        const now = Date.now();
        locations.value = parsed.locations.map((l: BentoLocation) => ({
          ...l,
          updatedAt: now,
        }));
      }
      if (parsed.records && Array.isArray(parsed.records)) {
        const now = Date.now();
        records.value = parsed.records.map((r: any) => ({
          ...r,
          mealCategory: r.mealCategory || 'lunch',
          status: r.status || 'confirmed',
          updatedAt: now,
        }));
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        settings.value = { ...settings.value, ...parsed.settings, updatedAt: Date.now() };
      }
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }

  function batchAddLocations(items: Omit<BentoLocation, 'id' | 'isDrawn' | 'createdAt'>[], overwrite = false) {
    const formatted: BentoLocation[] = items.map((item, idx) => ({
      ...item,
      id: (Date.now() + idx).toString() + Math.random().toString(36).substring(2, 5),
      isDrawn: false,
      createdAt: Date.now() + idx,
      updatedAt: Date.now() + idx,
    }));

    if (overwrite) {
      locations.value = formatted;
    } else {
      locations.value.push(...formatted);
    }
  }

  function switchMode(mode: 'personal' | 'team') {
    settings.value.activeMode = mode;
    const url = new URL(window.location.href);
    if (mode === 'personal') {
      if (url.searchParams.has('team') || url.searchParams.has('invite')) {
        url.searchParams.delete('team');
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url);
      }
    } else if (mode === 'team') {
      const activeTeamId = localStorage.getItem('weekly_bento_active_team');
      if (activeTeamId) {
        url.searchParams.set('team', activeTeamId);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url);
      }
    }
  }

  return {
    locations,
    records,
    settings,
    tombstones,
    addTombstone,
    setPersonalStorageNamespace,
    getTodayDateString,
    selectedCategory,
    setSelectedCategory,
    visibleMealCategories,
    updateEnabledMealCategories,
    availablePool,
    drawnList,
    isPoolEmpty,
    getRandomLocation,
    markLocationAsDrawn,
    resetPool,
    addDailyRecord,
    addDirectRecord,
    confirmDailyRecord,
    updateRecord,
    deleteRecord,
    restoreRecord,
    addLocation,
    batchAddLocations,
    updateLocation,
    deleteLocation,
    batchDeleteLocations,
    restoreDefaultLocations,
    exportDataJSON,
    importDataJSON,
    switchMode,
  };
}
