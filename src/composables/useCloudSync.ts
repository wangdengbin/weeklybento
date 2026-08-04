import { ref } from 'vue';
import { useBentoStore } from './useBentoStore';

const isSyncing = ref(false);
const syncLog = ref('');
const lastSyncedAt = ref<string>('');

// 读取环境变量
const ENV_API_URL = import.meta.env.VITE_JSONBIN_API_URL || '';
const ENV_API_KEY = import.meta.env.VITE_JSONBIN_API_KEY || '';

export function useCloudSync() {
  const { locations, records, importDataJSON } = useBentoStore();

  // 上传当前 state 数据至云端数据库
  async function pushToCloud(silent = false): Promise<{ success: boolean; message: string }> {
    if (!ENV_API_URL || !ENV_API_KEY) {
      return { success: false, message: '环境变量中未配置 JSONBin 凭据' };
    }

    if (!silent) {
      isSyncing.value = true;
      syncLog.value = '正在上传数据至云端...';
    }

    const payload = {
      locations: locations.value,
      records: records.value,
      updatedAt: new Date().toISOString(),
    };

    try {
      const resp = await fetch(ENV_API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': ENV_API_KEY,
          'X-Access-Key': ENV_API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        lastSyncedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        syncLog.value = `已同步到云端 (${lastSyncedAt.value})`;
        isSyncing.value = false;
        return { success: true, message: '成功推送数据到 JSONBin 云数据库！' };
      } else {
        const err = await resp.text();
        throw new Error(`JSONBin 响应 HTTP ${resp.status}: ${err}`);
      }
    } catch (e: any) {
      isSyncing.value = false;
      syncLog.value = `云端保存失败: ${e.message || e}`;
      return { success: false, message: `云端同步失败: ${e.message || e}` };
    }
  }

  // 从云端拉取最新数据
  async function pullFromCloud(silent = false): Promise<{ success: boolean; message: string }> {
    if (!ENV_API_URL || !ENV_API_KEY) {
      return { success: false, message: '环境变量中未配置 JSONBin 凭据' };
    }

    if (!silent) {
      isSyncing.value = true;
      syncLog.value = '正在从云端获取最新数据...';
    }

    try {
      const resp = await fetch(ENV_API_URL, {
        method: 'GET',
        headers: {
          'X-Master-Key': ENV_API_KEY,
          'X-Access-Key': ENV_API_KEY,
        },
      });

      if (!resp.ok) {
        throw new Error(`HTTP 请求失败 ${resp.status}`);
      }

      const data = await resp.json();
      const recordObj = data.record || data;

      // 更新本地 Store
      const success = importDataJSON(JSON.stringify(recordObj));
      isSyncing.value = false;

      if (success) {
        lastSyncedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        syncLog.value = `已从云端拉取最新数据 (${lastSyncedAt.value})`;
        return { success: true, message: '成功从云端同步最新数据！' };
      } else {
        return { success: false, message: '云端返回数据结构不正确' };
      }
    } catch (e: any) {
      isSyncing.value = false;
      syncLog.value = `从云端拉取失败: ${e.message || e}`;
      return { success: false, message: `拉取失败: ${e.message || e}` };
    }
  }

  return {
    isSyncing,
    syncLog,
    lastSyncedAt,
    pushToCloud,
    pullFromCloud,
  };
}
