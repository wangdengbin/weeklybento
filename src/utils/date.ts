import type { MealCategory } from '../types';

// “今天”统一使用 Asia/Shanghai 时区，与团队业务日期(roll_team RPC)保持一致，
// 避免凌晨 0-8 点 UTC 日期与本地日期错位导致结果卡片不显示/记录记到昨天
export function getTodayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

// 本周一日期字符串 (Asia/Shanghai 时区)，用于“按周不重复”逻辑
export function getMondayDateString(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(monday);
}

// 默认餐池分类：依据当前时段返回
export function getDefaultMealCategoryByTime(): MealCategory {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'tea';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'night';
}