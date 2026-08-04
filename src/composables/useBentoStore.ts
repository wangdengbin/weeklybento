import { ref, computed, watch } from 'vue';
import type { BentoLocation, DailyRecord, AppSettings, MealCategory, RecordStatus } from '../types';

const STORAGE_KEY_LOCATIONS = 'weekly_bento_locations_v3';
const STORAGE_KEY_RECORDS = 'weekly_bento_records_v1';
const STORAGE_KEY_SETTINGS = 'weekly_bento_settings_v1';

export function getDefaultMealCategoryByTime(): MealCategory {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'tea';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'night';
}

// 预设默认地点池 (增加部分多样性分类)
const DEFAULT_LOCATIONS: BentoLocation[] = [
  { id: '1', name: '隆江猪脚饭', emoji: '🍱', tags: ['快餐', '肉食', '高能量'], priceRange: '￥18-28', recommendedDish: '双拼猪脚饭加卤蛋', weight: 1, isDrawn: false, createdAt: Date.now(), mealCategories: ['lunch', 'dinner'] },
  { id: '2', name: '日式拉面', emoji: '🍜', tags: ['汤面', '日料', '热乎'], priceRange: '￥25-45', recommendedDish: '豚骨叉烧拉面', weight: 1, isDrawn: false, createdAt: Date.now() + 1, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '3', name: '麻辣香锅', emoji: '🥘', tags: ['重口味', '下饭', '香辣'], priceRange: '￥30-50', recommendedDish: '牛肉+午餐肉+方便面', weight: 1, isDrawn: false, createdAt: Date.now() + 2, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '4', name: '萨莉亚 Saizeriya', emoji: '🍕', tags: ['西餐', '性价比', '快乐餐'], priceRange: '￥20-35', recommendedDish: '蒜香蜗牛+金米饭', weight: 1, isDrawn: false, createdAt: Date.now() + 3, mealCategories: ['lunch', 'dinner'] },
  { id: '5', name: '酸菜鱼饭', emoji: '🐟', tags: ['酸辣', '下饭', '鱼肉'], priceRange: '￥25-38', recommendedDish: '老坛酸菜无骨鱼', weight: 1, isDrawn: false, createdAt: Date.now() + 4, mealCategories: ['lunch', 'dinner'] },
  { id: '6', name: '轻食沙拉碗', emoji: '🥗', tags: ['减脂', '清淡', '健康'], priceRange: '￥28-40', recommendedDish: '香煎鸡胸肉沙拉', weight: 1, isDrawn: false, createdAt: Date.now() + 5, mealCategories: ['breakfast', 'lunch', 'dinner'] },
  { id: '7', name: '潮汕牛肉粿条', emoji: '🍲', tags: ['清淡', '鲜美', '广东特色'], priceRange: '￥20-35', recommendedDish: '吊龙牛肉汤粿条', weight: 1, isDrawn: false, createdAt: Date.now() + 6, mealCategories: ['breakfast', 'lunch', 'dinner', 'night'] },
  { id: '8', name: '美式手工汉堡', emoji: '🍔', tags: ['美式', '高热量', '解压'], priceRange: '￥35-60', recommendedDish: '双层芝士牛肉堡', weight: 1, isDrawn: false, createdAt: Date.now() + 7, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '9', name: '四川麻辣烫', emoji: '🍢', tags: ['自选', '麻辣', '丰富'], priceRange: '￥20-35', recommendedDish: '骨汤中辣+芝麻酱', weight: 1, isDrawn: false, createdAt: Date.now() + 8, mealCategories: ['lunch', 'dinner', 'night'] },
  { id: '10', name: '黄焖鸡米饭', emoji: '🍗', tags: ['经典', '米饭', '香浓'], priceRange: '￥18-26', recommendedDish: '加辣黄焖鸡+腐竹', weight: 1, isDrawn: false, createdAt: Date.now() + 9, mealCategories: ['lunch', 'dinner'] },
  { id: '11', name: '霸王茶姬 / 喜茶', emoji: '🧋', tags: ['饮品', '奶茶', '续命'], priceRange: '￥15-22', recommendedDish: '伯牙绝弦大杯去冰', weight: 1, isDrawn: false, createdAt: Date.now() + 10, mealCategories: ['tea'] },
  { id: '12', name: '精品生椰拿铁/美式', emoji: '☕', tags: ['咖啡', '提神', '下午茶'], priceRange: '￥12-25', recommendedDish: '生椰拿铁无糖', weight: 1, isDrawn: false, createdAt: Date.now() + 11, mealCategories: ['breakfast', 'tea'] },
  { id: '13', name: '广式早茶小笼包', emoji: '🥟', tags: ['早点', '热乎', '地道'], priceRange: '￥15-30', recommendedDish: '鲜肉小笼包+生滚皮蛋瘦肉粥', weight: 1, isDrawn: false, createdAt: Date.now() + 12, mealCategories: ['breakfast'] },
  { id: '14', name: '深夜大排档烧烤串串', emoji: '🍢', tags: ['夜宵', '解馋', '下酒'], priceRange: '￥30-60', recommendedDish: '烤五花肉+五香羊肉串', weight: 1, isDrawn: false, createdAt: Date.now() + 13, mealCategories: ['night'] },
  { id: '15', name: '便利店便当/三明治', emoji: '🍙', tags: ['快速', '省钱', '便利'], priceRange: '￥12-22', recommendedDish: '照烧鸡腿便当+关东煮', weight: 1, isDrawn: false, createdAt: Date.now() + 14, mealCategories: ['breakfast', 'lunch', 'night'] },
  { id: '16', name: '海南鸡饭', emoji: '🐔', tags: ['鲜嫩', '米饭', '东南亚'], priceRange: '￥25-38', recommendedDish: '白切鸡饭三色酱', weight: 1, isDrawn: false, createdAt: Date.now() + 15, mealCategories: ['lunch', 'dinner'] },
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
      if (Array.isArray(parsed)) {
        // 兼容旧数据：补齐 mealCategory 和 status
        return parsed.map(r => ({
          ...r,
          mealCategory: r.mealCategory || 'lunch',
          status: r.status || 'confirmed',
        }));
      }
    }
  } catch (e) {}
  return [];
}

function getMondayDateString(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(monday);
}

function loadSettings(): AppSettings {
  const defaultSettings: AppSettings = {
    adminPassword: 'admin888',
    antiRepeatMode: 'round',
    weeklyNoRepeat: true,
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
const selectedCategory = ref<MealCategory>(getDefaultMealCategoryByTime());

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
  // 根据餐池过滤地点
  function isLocationMatchingCategory(loc: BentoLocation, category: MealCategory): boolean {
    if (!loc.mealCategories || loc.mealCategories.length === 0) return true;
    return loc.mealCategories.includes(category);
  }

  // 当前激活餐池的所有有效未抽地点
  const availablePool = computed(() => {
    const categoryPool = locations.value.filter(loc => isLocationMatchingCategory(loc, selectedCategory.value));
    const basePool = categoryPool.filter(loc => !loc.isDrawn);
    
    // 降级策略：当前餐池未抽池 -> 当前餐池全量池 -> 所有地点未抽池 -> 全量地点
    const poolToUse = basePool.length > 0 
      ? basePool 
      : (categoryPool.length > 0 ? categoryPool : locations.value.filter(loc => !loc.isDrawn));

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

  const drawnList = computed(() => locations.value.filter(loc => loc.isDrawn));
  const isPoolEmpty = computed(() => availablePool.value.length === 0);

  function setSelectedCategory(cat: MealCategory) {
    selectedCategory.value = cat;
  }

  function getRandomLocation(category?: MealCategory): BentoLocation | null {
    const targetCat = category || selectedCategory.value;
    const catLocations = locations.value.filter(loc => isLocationMatchingCategory(loc, targetCat));
    const basePool = catLocations.filter(loc => !loc.isDrawn);
    const pool = basePool.length > 0 ? basePool : (catLocations.length > 0 ? catLocations : locations.value);
    
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

  // 添加或覆盖预选/确定打卡记录
  function addDailyRecord(
    loc: BentoLocation, 
    customDate?: string, 
    customNote?: string, 
    category?: MealCategory, 
    status: RecordStatus = 'planned', 
    cost?: number
  ): DailyRecord {
    const today = customDate || new Date().toISOString().slice(0, 10);
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
      cost: cost
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
      };
    }
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
        records.value = parsed.records.map((r: any) => ({
          ...r,
          mealCategory: r.mealCategory || 'lunch',
          status: r.status || 'confirmed',
        }));
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
    selectedCategory,
    setSelectedCategory,
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

