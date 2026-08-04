import { ref, computed, watch } from 'vue';
import type { BentoLocation, DailyRecord, AppSettings } from '../types';

const STORAGE_KEY_LOCATIONS = 'weekly_bento_locations_v3';
const STORAGE_KEY_RECORDS = 'weekly_bento_records_v1';
const STORAGE_KEY_SETTINGS = 'weekly_bento_settings_v1';

// 预设默认午餐地点池 (还原 16 项经典地点)
const DEFAULT_LOCATIONS: BentoLocation[] = [
  { id: '1', name: '隆江猪脚饭', emoji: '🍱', tags: ['快餐', '肉食', '高能量'], priceRange: '￥18-28', recommendedDish: '双拼猪脚饭加卤蛋', weight: 1, isDrawn: false, createdAt: Date.now() },
  { id: '2', name: '日式拉面', emoji: '🍜', tags: ['汤面', '日料', '热乎'], priceRange: '￥25-45', recommendedDish: '豚骨叉烧拉面', weight: 1, isDrawn: false, createdAt: Date.now() + 1 },
  { id: '3', name: '麻辣香锅', emoji: '🥘', tags: ['重口味', '下饭', '香辣'], priceRange: '￥30-50', recommendedDish: '牛肉+午餐肉+方便面', weight: 1, isDrawn: false, createdAt: Date.now() + 2 },
  { id: '4', name: '萨莉亚 Saizeriya', emoji: '🍕', tags: ['西餐', '性价比', '快乐餐'], priceRange: '￥20-35', recommendedDish: '蒜香蜗牛+金米饭', weight: 1, isDrawn: false, createdAt: Date.now() + 3 },
  { id: '5', name: '酸菜鱼饭', emoji: '🐟', tags: ['酸辣', '下饭', '鱼肉'], priceRange: '￥25-38', recommendedDish: '老坛酸菜无骨鱼', weight: 1, isDrawn: false, createdAt: Date.now() + 4 },
  { id: '6', name: '轻食沙拉碗', emoji: '🥗', tags: ['减脂', '清淡', '健康'], priceRange: '￥28-40', recommendedDish: '香煎鸡胸肉沙拉', weight: 1, isDrawn: false, createdAt: Date.now() + 5 },
  { id: '7', name: '潮汕牛肉粿条', emoji: '🍲', tags: ['清淡', '鲜美', '广东特色'], priceRange: '￥20-35', recommendedDish: '吊龙牛肉汤粿条', weight: 1, isDrawn: false, createdAt: Date.now() + 6 },
  { id: '8', name: '美式手工汉堡', emoji: '🍔', tags: ['美式', '高热量', '解压'], priceRange: '￥35-60', recommendedDish: '双层芝士牛肉堡', weight: 1, isDrawn: false, createdAt: Date.now() + 7 },
  { id: '9', name: '四川麻辣烫', emoji: '🍢', tags: ['自选', '麻辣', '丰富'], priceRange: '￥20-35', recommendedDish: '骨汤中辣+芝麻酱', weight: 1, isDrawn: false, createdAt: Date.now() + 8 },
  { id: '10', name: '黄焖鸡米饭', emoji: '🍗', tags: ['经典', '米饭', '香浓'], priceRange: '￥18-26', recommendedDish: '加辣黄焖鸡+腐竹', weight: 1, isDrawn: false, createdAt: Date.now() + 9 },
  { id: '11', name: '韩式石锅拌饭', emoji: '🍲', tags: ['韩料', '锅巴', '甜辣'], priceRange: '￥22-35', recommendedDish: '肥牛石锅拌饭', weight: 1, isDrawn: false, createdAt: Date.now() + 10 },
  { id: '12', name: '新疆炒米粉', emoji: '🍝', tags: ['特辣', '米粉', '过瘾'], priceRange: '￥22-32', recommendedDish: '酱香鸡肉爆辣炒米粉', weight: 1, isDrawn: false, createdAt: Date.now() + 11 },
  { id: '13', name: '金牌烧鹅饭', emoji: '🦆', tags: ['烧蜡', '经典', '香脆'], priceRange: '￥30-50', recommendedDish: '烧鹅腿双拼饭', weight: 1, isDrawn: false, createdAt: Date.now() + 12 },
  { id: '14', name: '桂林柳州螺蛳粉', emoji: '🍜', tags: ['重口味', '酸辣', '臭香'], priceRange: '￥15-25', recommendedDish: '加炸蛋+炸腐竹', weight: 1, isDrawn: false, createdAt: Date.now() + 13 },
  { id: '15', name: '便利店便当/三明治', emoji: '🍙', tags: ['快速', '省钱', '便利'], priceRange: '￥12-22', recommendedDish: '照烧鸡腿便当+关东煮', weight: 1, isDrawn: false, createdAt: Date.now() + 14 },
  { id: '16', name: '海南鸡饭', emoji: '🐔', tags: ['鲜嫩', '米饭', '东南亚'], priceRange: '￥25-38', recommendedDish: '白切鸡饭三色酱', weight: 1, isDrawn: false, createdAt: Date.now() + 15 },
];

function loadLocations(): BentoLocation[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_LOCATIONS);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return DEFAULT_LOCATIONS;
}

function loadRecords(): DailyRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function loadSettings(): AppSettings {
  const defaultSettings: AppSettings = {
    adminPassword: 'admin888',
    antiRepeatMode: 'round',
    soundEnabled: true,
    activeMode: 'personal',
    personalSyncConfig: {
      enabled: false,
      provider: 'jsonbin',
      apiUrl: '',
      apiKey: '',
      keyType: 'auto',
      autoSync: false,
    },
  };
  try {
    const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (data) return { ...defaultSettings, ...JSON.parse(data) };
  } catch (e) {}
  return defaultSettings;
}

const locations = ref<BentoLocation[]>(loadLocations());
const records = ref<DailyRecord[]>(loadRecords());
const settings = ref<AppSettings>(loadSettings());

// 本地内存与缓存监听
watch(locations, (val) => {
  localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(val));
}, { deep: true });

watch(records, (val) => {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(val));
}, { deep: true });

watch(settings, (val) => {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(val));
}, { deep: true });

export function useBentoStore() {
  const availablePool = computed(() => locations.value.filter(loc => !loc.isDrawn));
  const drawnList = computed(() => locations.value.filter(loc => loc.isDrawn));
  const isPoolEmpty = computed(() => availablePool.value.length === 0);

  function getRandomLocation(): BentoLocation | null {
    const pool = availablePool.value.length > 0 ? availablePool.value : locations.value;
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
    }
  }

  function resetPool() {
    locations.value.forEach(l => { l.isDrawn = false; });
  }

  function addDailyRecord(loc: BentoLocation, customDate?: string, customNote?: string): DailyRecord {
    const today = customDate || new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const existingIndex = records.value.findIndex(r => r.date === today);

    const newRecord: DailyRecord = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      date: today,
      locationId: loc.id,
      locationName: loc.name,
      emoji: loc.emoji,
      tags: loc.tags || [],
      drawnAt: nowTime,
      note: customNote || loc.recommendedDish || '美味的一餐！'
    };

    if (existingIndex >= 0) {
      records.value[existingIndex] = newRecord;
    } else {
      records.value.unshift(newRecord);
    }

    return newRecord;
  }

  function updateRecord(updatedRecord: DailyRecord) {
    const index = records.value.findIndex(r => r.id === updatedRecord.id);
    if (index >= 0) {
      records.value[index] = { ...updatedRecord };
    }
  }

  function deleteRecord(id: string) {
    records.value = records.value.filter(r => r.id !== id);
  }

  function addLocation(locationData: Omit<BentoLocation, 'id' | 'isDrawn' | 'createdAt'>) {
    const newLoc: BentoLocation = {
      ...locationData,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      isDrawn: false,
      createdAt: Date.now(),
    };
    locations.value.push(newLoc);
  }

  function updateLocation(updated: BentoLocation) {
    const index = locations.value.findIndex(l => l.id === updated.id);
    if (index >= 0) {
      locations.value[index] = { ...updated };
    }
  }

  function deleteLocation(id: string) {
    locations.value = locations.value.filter(l => l.id !== id);
  }

  function batchDeleteLocations(ids: string[]) {
    const set = new Set(ids);
    locations.value = locations.value.filter(l => !set.has(l.id));
  }

  function restoreDefaultLocations() {
    locations.value = JSON.parse(JSON.stringify(DEFAULT_LOCATIONS));
  }

  function exportDataJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      locations: locations.value,
      records: records.value,
      settings: settings.value,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WeeklyBento_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importDataJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.locations && Array.isArray(parsed.locations)) {
        locations.value = parsed.locations;
      }
      if (parsed.records && Array.isArray(parsed.records)) {
        records.value = parsed.records;
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        settings.value = { ...settings.value, ...parsed.settings };
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
    }));

    if (overwrite) {
      locations.value = formatted;
    } else {
      locations.value.push(...formatted);
    }
  }

  function switchMode(mode: 'personal' | 'team') {
    settings.value.activeMode = mode;
  }

  return {
    locations,
    records,
    settings,
    availablePool,
    drawnList,
    isPoolEmpty,
    getRandomLocation,
    markLocationAsDrawn,
    resetPool,
    addDailyRecord,
    updateRecord,
    deleteRecord,
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
