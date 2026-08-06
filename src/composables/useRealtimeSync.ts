import { ref } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * 可复用的 Supabase Realtime 订阅 composable。
 *
 * - 订阅一组按 `user_id` 隔离的表（schema: public），事件统一回调
 * - 回调支持防抖合并：窗口内所有事件**累积为数组**一次性回调（而非只留最后一个），
 *   由调用方自行判断是否需要处理，避免"最后事件是自身回声"导致漏掉前面的真实变更
 * - 模块级单例：一个应用只需一份个人/团队同步订阅，多组件共享同一状态
 * - 暴露订阅状态（idle / connecting / subscribed / error / closed），供 UI 提示
 *
 * 用法：
 *   const { status, subscribe, unsubscribe } = useRealtimeSync();
 *   subscribe({ userId, tables: [{ table: 'user_records' }], onChange: (payloads) => {...} });
 */

export type RealtimeSyncStatus = 'idle' | 'connecting' | 'subscribed' | 'error' | 'closed';

export interface RealtimeSyncTable {
  table: string;
}

export interface RealtimeChangePayload {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: any;
  old: any;
  [key: string]: any;
}

// 模块级单例状态
const status = ref<RealtimeSyncStatus>('idle');
const activeChannelName = ref('');
let channel: RealtimeChannel | null = null;
let boundUserId = '';
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPayloads: RealtimeChangePayload[] = [];
let lastOnChange: ((payloads: RealtimeChangePayload[]) => void) | null = null;
let lastOnStatusChange: ((s: RealtimeSyncStatus) => void) | null = null;
let lastDebounceMs = 400;

function fireDebounced(payload: RealtimeChangePayload) {
  if (!lastOnChange) return;
  pendingPayloads.push(payload);
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const batch = pendingPayloads;
    pendingPayloads = [];
    if (lastOnChange && batch.length > 0) lastOnChange(batch);
  }, lastDebounceMs);
}

export function useRealtimeSync() {
  /**
   * 建立（或复用）当前用户的实时订阅。
   * 重复调用相同 userId 且连接健康时保持已有订阅不变；切换 userId 或连接出错时自动重建。
   */
  function subscribe(opts: {
    userId: string;
    tables: RealtimeSyncTable[];
    onChange: (payloads: RealtimeChangePayload[]) => void;
    debounceMs?: number;
    onStatusChange?: (s: RealtimeSyncStatus) => void;
  }): void {
    const { userId, tables, onChange, debounceMs = 400, onStatusChange } = opts;
    if (!supabase || !userId) return;

    // 同一用户且连接仍健康：仅更新回调与防抖配置，不重复建连
    const healthy = status.value === 'subscribed' || status.value === 'connecting';
    if (channel && boundUserId === userId && healthy) {
      lastOnChange = onChange;
      lastOnStatusChange = onStatusChange ?? null;
      lastDebounceMs = debounceMs;
      onStatusChange?.(status.value);
      return;
    }

    unsubscribe();
    boundUserId = userId;
    lastOnChange = onChange;
    lastOnStatusChange = onStatusChange ?? null;
    lastDebounceMs = debounceMs;

    status.value = 'connecting';
    activeChannelName.value = `realtime-${userId}`;
    onStatusChange?.(status.value);

    const ch = supabase.channel(activeChannelName.value);
    channel = ch;

    for (const t of tables) {
      ch.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: t.table, filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const normalized: RealtimeChangePayload = {
            table: t.table,
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            ...payload,
          };
          fireDebounced(normalized);
        }
      );
    }

    ch.subscribe((subStatus: string, err?: Error) => {
      // 迟到回调守卫：切号后旧 channel 的 CLOSED/error 不得覆盖新 channel 的状态
      if (channel !== ch) return;
      if (subStatus === 'SUBSCRIBED') {
        status.value = 'subscribed';
      } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
        status.value = 'error';
        console.warn('[RealtimeSync] 订阅失败，已降级为打开页面/手动同步:', err);
      } else if (subStatus === 'CLOSED') {
        status.value = 'closed';
      }
      lastOnStatusChange?.(status.value);
    });
  }

  /** 销毁当前订阅并重置状态 */
  function unsubscribe(): void {
    if (channel && supabase) {
      supabase.removeChannel(channel);
    }
    channel = null;
    boundUserId = '';
    lastOnChange = null;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingPayloads = [];
    status.value = 'idle';
    activeChannelName.value = '';
    lastOnStatusChange?.(status.value);
  }

  return {
    status,
    activeChannelName,
    subscribe,
    unsubscribe,
  };
}
