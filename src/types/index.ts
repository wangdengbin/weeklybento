export interface BentoLocation {
  id: string;
  name: string;
  emoji: string;
  tags: string[];
  priceRange: string; // e.g. '￥15-25'
  recommendedDish?: string; // 推荐菜品
  weight: number; // 权重
  isDrawn: boolean; // 在当前轮次中是否已被抽中
  createdAt: number;
}

export interface DailyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  locationId: string;
  locationName: string;
  emoji: string;
  tags: string[];
  drawnAt: string; // HH:mm:ss
  note?: string; // 备注/用餐心得
}

export interface CloudSyncConfig {
  enabled: boolean;
  provider: 'jsonbin' | 'supabase' | 'custom_api';
  apiUrl: string; // e.g. https://api.jsonbin.io/v3/b/<BIN_ID> 或 Supabase REST URL
  apiKey: string; // Master Key 或 Anon Key
  autoSync: boolean; // 是否自动变动同步
}

export interface AppSettings {
  adminPassword: string;
  antiRepeatMode: 'round' | 'none'; // 'round': 抽完为止自动/手动重置
  soundEnabled: boolean;
  cloudSync?: CloudSyncConfig;
}

