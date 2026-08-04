import { ref } from 'vue';
import { useBentoStore } from './useBentoStore';

const isSyncing = ref(false);
const syncLog = ref('');
const lastSyncedAt = ref<string>('');

// 读取环境变量
const ENV_API_URL = import.meta.env.VITE_JSONBIN_API_URL || '';
const ENV_API_KEY = import.meta.env.VITE_JSONBIN_API_KEY || '';

/**
 * 自动双重 Header 兼容请求：
 * JSONBin 如果在请求头中同时存在 X-Master-Key 与 X-Access-Key，会强制校验 X-Master-Key。
 * 此函数先使用 X-Master-Key 请求，若遇到 401/403，自动无缝切换为 X-Access-Key 重新请求，确保 Master Key 和 Access Key 均能 100% 成功。
 */
async function fetchJsonbinWithFallback(url: string, method: string, payload?: any): Promise<Response> {
  if (!ENV_API_URL || !ENV_API_KEY) {
    throw new Error('环境变量中未配置 JSONBin 凭据');
  }

  // 第一次尝试：使用 X-Master-Key
  const headersMaster: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Master-Key': ENV_API_KEY,
  };

  let resp = await fetch(url, {
    method,
    headers: headersMaster,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  // 如果遇到 401 / 403 身份不匹配，自动无缝降级重试 X-Access-Key
  if (resp.status === 401 || resp.status === 403) {
    const headersAccess: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Access-Key': ENV_API_KEY,
    };
    const respRetry = await fetch(url, {
      method,
      headers: headersAccess,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (respRetry.ok) {
      return respRetry;
    }
  }

  return resp;
}

export function useCloudSync() {
  const { locations, records, importDataJSON } = useBentoStore();

  // 上传当前 state 数据至云端数据库
  async function pushToCloud(silent = false): Promise<{ success: boolean; message: string }> {
    if (!ENV_API_URL || !ENV_API_KEY) {
      return { success: false, message: '环境变量中未配置 JSONBin 凭据' };
    }

    if (!silent) {
      isSyncing.value = true;
      syncLog.value = '正在保存至云端...';
    }

    const payload = {
      locations: locations.value,
      records: records.value,
      updatedAt: new Date().toISOString(),
    };

    try {
      const resp = await fetchJsonbinWithFallback(ENV_API_URL, 'PUT', payload);

      if (resp.ok) {
        lastSyncedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        syncLog.value = `已同步到云端 (${lastSyncedAt.value})`;
        isSyncing.value = false;
        return { success: true, message: '成功推送数据到 JSONBin 云数据库！' };
      } else {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
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
      const resp = await fetchJsonbinWithFallback(ENV_API_URL, 'GET');

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText}`);
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
