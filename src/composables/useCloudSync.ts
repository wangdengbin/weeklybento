import { ref } from 'vue';
import { useBentoStore } from './useBentoStore';
import type { CloudSyncConfig } from '../types';

const isSyncing = ref(false);
const syncLog = ref('');
const lastSyncedAt = ref<string>('');

type JsonbinKeyType = 'master' | 'access';

function resolveSyncConfig(overrideConfig?: Partial<CloudSyncConfig>): CloudSyncConfig {
  const { settings } = useBentoStore();
  let config: CloudSyncConfig = {
    enabled: true,
    provider: 'jsonbin',
    apiUrl: '',
    apiKey: '',
    keyType: 'auto',
    autoSync: false,
  };
  const personalConfig = settings.value.personalSyncConfig;
  config.apiUrl = personalConfig?.apiUrl?.trim() || '';
  config.apiKey = personalConfig?.apiKey?.trim() || '';
  config.keyType = personalConfig?.keyType || 'auto';

  if (overrideConfig) {
    config = { ...config, ...overrideConfig };
  }

  return config;
}

function getConfigError(config: CloudSyncConfig): string | null {
  if (!config.apiUrl) return '未配置云端 API URL (如 JSONBin 链接)';
  if (!config.apiKey) return '未配置云端 API Key';
  if (!/^https:\/\/api\.jsonbin\.io\/v3\/b\/[^/?]+\/?$/.test(config.apiUrl)) {
    return 'API URL 格式不正确，标准格式应为 https://api.jsonbin.io/v3/b/<BIN_ID>';
  }
  return null;
}

function getJsonbinHeaders(apiKey: string, keyType: JsonbinKeyType): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    [keyType === 'master' ? 'X-Master-Key' : 'X-Access-Key']: apiKey,
  };
}

async function fetchJsonbin(config: CloudSyncConfig, method: string, payload?: unknown): Promise<Response> {
  const configError = getConfigError(config);
  if (configError) throw new Error(configError);

  const keyTypeSetting = config.keyType || 'auto';
  const keyTypes: JsonbinKeyType[] = keyTypeSetting === 'auto'
    ? ['master', 'access']
    : [keyTypeSetting as JsonbinKeyType];

  let response: Response | undefined;
  for (const keyType of keyTypes) {
    response = await fetch(config.apiUrl, {
      method,
      headers: getJsonbinHeaders(config.apiKey, keyType),
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (response.ok || ![401, 403].includes(response.status)) return response;
  }

  return response!;
}

async function getResponseError(response: Response): Promise<Error> {
  const detail = await response.text();
  if ([401, 403].includes(response.status)) {
    return new Error(
      `JSONBin 鉴权失败 (${response.status})：API Key 无效，或该 Bin 不属于此 Key 对应的账号。`,
    );
  }
  return new Error(`HTTP ${response.status}: ${detail}`);
}

export function useCloudSync() {
  const { locations, records, importDataJSON } = useBentoStore();

  async function pushToCloud(silent = false, customConfig?: Partial<CloudSyncConfig>): Promise<{ success: boolean; message: string }> {
    const config = resolveSyncConfig(customConfig);
    const configError = getConfigError(config);
    if (configError) return { success: false, message: configError };

    if (!silent) {
      isSyncing.value = true;
      syncLog.value = '正在推送最新数据至云端...';
    }

    const payload = {
      locations: locations.value,
      records: records.value,
      updatedAt: new Date().toISOString(),
    };

    try {
      const response = await fetchJsonbin(config, 'PUT', payload);
      if (!response.ok) throw await getResponseError(response);

      lastSyncedAt.value = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      syncLog.value = `已成功推送到云端 (${lastSyncedAt.value})`;
      return { success: true, message: '成功推送数据到云数据库！' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      syncLog.value = `云端推送失败: ${message}`;
      return { success: false, message: `同步推送失败: ${message}` };
    } finally {
      isSyncing.value = false;
    }
  }

  async function pullFromCloud(silent = false, customConfig?: Partial<CloudSyncConfig>): Promise<{ success: boolean; message: string }> {
    const config = resolveSyncConfig(customConfig);
    const configError = getConfigError(config);
    if (configError) return { success: false, message: configError };

    if (!silent) {
      isSyncing.value = true;
      syncLog.value = '正在从云端拉取最新数据...';
    }

    try {
      const response = await fetchJsonbin(config, 'GET');
      if (!response.ok) throw await getResponseError(response);

      const data = await response.json();
      const recordObj = data.record || data;
      const success = importDataJSON(JSON.stringify(recordObj));
      if (!success) return { success: false, message: '云端返回的数据结构格式不正确' };

      lastSyncedAt.value = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      syncLog.value = `已从云端同步最新数据 (${lastSyncedAt.value})`;
      return { success: true, message: '成功从云端同步最新数据！' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      syncLog.value = `从云端拉取失败: ${message}`;
      return { success: false, message: `拉取失败: ${message}` };
    } finally {
      isSyncing.value = false;
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
