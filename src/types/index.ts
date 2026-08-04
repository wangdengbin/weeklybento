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
  apiUrl: string; // e.g. https://api.jsonbin.io/v3/b/<BIN_ID>
  apiKey: string; // Master Key 或 Access Key
  keyType?: 'auto' | 'master' | 'access';
  autoSync: boolean; // 是否自动变动同步
}

export interface TeamRollResult {
  date: string; // YYYY-MM-DD
  locationId: string;
  locationName: string;
  emoji: string;
  tags: string[];
  recommendedDish?: string;
  priceRange?: string;
  rolledAt: string; // HH:mm:ss
  rolledBy?: string; // 摇号人标识
}

export interface AppSettings {
  adminPassword: string;
  antiRepeatMode: 'round' | 'none'; // 'round': 抽完为止自动/手动重置
  weeklyNoRepeat?: boolean; // 是否开启按周不重复 Roll 模式
  soundEnabled: boolean;
  activeMode: 'personal' | 'team'; // 当前激活模式
  personalSyncConfig?: CloudSyncConfig; // 个人云端同步设置
  cloudSync?: CloudSyncConfig; // 兼容逻辑
}
