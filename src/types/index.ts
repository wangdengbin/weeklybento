export type MealCategory = 'breakfast' | 'lunch' | 'tea' | 'dinner' | 'night';
export type RecordStatus = 'planned' | 'confirmed';

export interface MealCategoryInfo {
  key: MealCategory;
  name: string;
  emoji: string;
  timeRange: string;
  description: string;
}

export const MEAL_CATEGORIES: MealCategoryInfo[] = [
  { key: 'breakfast', name: '早餐池', emoji: '🌅', timeRange: '06:00-10:30', description: '快捷热乎的早晨能量' },
  { key: 'lunch', name: '午餐池', emoji: '☀️', timeRange: '10:30-14:00', description: '高效丰盛的工作日正餐' },
  { key: 'tea', name: '咖啡/奶茶', emoji: '🧋', timeRange: '14:00-17:00', description: '提神解压的咖啡茶饮' },
  { key: 'dinner', name: '晚餐池', emoji: '🌙', timeRange: '17:00-21:00', description: '休闲舒适的傍晚聚餐' },
  { key: 'night', name: '夜宵池', emoji: '🌌', timeRange: '21:00-06:00', description: '深夜解馋的特调好味' },
];

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
  updatedAt?: number; // 最后修改时间(ms)，用于云同步冲突合并
  mealCategories?: MealCategory[]; // 支持的餐池分类，不传默认全选/包含午餐
  address?: string; // 详细地址（如：“科技园路 88 号 2 楼”）
  mapUrl?: string; // 自定义导航跳转链接
  visible?: boolean; // 是否在抽签池中展示 (默认为 true)
}

export interface TeamPermissions {
  allowMemberReroll: boolean; // 是否允许团队普通成员重新 Roll
  allowMemberEditLocation: boolean; // 是否允许团队普通成员编辑地点池
  enabledMealCategories?: MealCategory[]; // 开启展示的餐池分类
}

export interface DailyRecord {
  id: string;
  date: string; // YYYY-MM-DD
  mealCategory?: MealCategory; // 餐池分类
  status?: RecordStatus; // 'planned' (预选计划) | 'confirmed' (确定打卡)
  locationId: string;
  locationName: string;
  emoji: string;
  tags: string[];
  drawnAt: string; // HH:mm:ss
  note?: string; // 备注/用餐心得
  cost?: number; // 实付金额 (仅个人模式生效)
  address?: string; // 打卡时的历史地址快照
  mapUrl?: string; // 打卡时的历史导航链接快照
  updatedAt?: number; // 最后修改时间(ms)，用于云同步冲突合并
}

export interface SyncTombstone {
  kind: 'record' | 'location';
  id: string;
  deletedAt: number; // 删除时间(ms)
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
  mealCategory?: MealCategory; // 餐池分类
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
  monthlyBudget?: number; // 月伙食预算 (0 或 undefined 表示未设置)
  enabledMealCategories?: MealCategory[]; // 开启展示的餐池分类列表
  updatedAt?: number; // 设置最后修改时间(ms)，用于云同步冲突合并
}
