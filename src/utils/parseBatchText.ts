import type { MealCategory } from '../types';

export interface ParsedLocationItem {
  name: string;
  emoji: string;
  tags: string[];
  priceRange: string;
  recommendedDish?: string;
  weight: number;
  mealCategories?: MealCategory[];
}

/**
 * 自动根据名称与标签关键词识别匹配合适 Emoji
 */
export function autoPickEmoji(name: string, tags: string[]): string {
  const combined = (name + ' ' + tags.join(' ')).toLowerCase();

  if (combined.includes('奶茶') || combined.includes('茶饮') || combined.includes('果茶')) return '🧋';
  if (combined.includes('咖啡') || combined.includes('拿铁') || combined.includes('美式')) return '☕';
  if (combined.includes('早茶') || combined.includes('包子') || combined.includes('粥')) return '🥟';
  if (combined.includes('烧烤') || combined.includes('大排档')) return '🍢';
  if (combined.includes('麻辣烫') || combined.includes('串串') || combined.includes('冒菜')) return '🍢';
  if (combined.includes('拉面') || combined.includes('面条') || combined.includes('汤面') || combined.includes('螺蛳粉') || combined.includes('米粉') || combined.includes('粿条')) return '🍜';
  if (combined.includes('炒菜') || combined.includes('中餐') || combined.includes('小炒')) return '🍳';
  if (combined.includes('自助') || combined.includes('便当') || combined.includes('快餐') || combined.includes('猪脚饭')) return '🍱';
  if (combined.includes('美食城') || combined.includes('综合') || combined.includes('档口') || combined.includes('食堂')) return '🏢';
  if (combined.includes('汉堡') || combined.includes('美式') || combined.includes('薯条')) return '🍔';
  if (combined.includes('披萨') || combined.includes('意面') || combined.includes('萨莉亚')) return '🍕';
  if (combined.includes('轻食') || combined.includes('沙拉') || combined.includes('减脂')) return '🥗';
  if (combined.includes('鱼') || combined.includes('酸菜鱼')) return '🐟';
  if (combined.includes('鸡') || combined.includes('烧鹅') || combined.includes('烤鸭')) return '🍗';
  if (combined.includes('火锅') || combined.includes('香锅') || combined.includes('汤')) return '🍲';

  return '🍱';
}

/**
 * 智能判断地点适合的场景餐池
 */
export function autoPickMealCategories(name: string, tags: string[]): MealCategory[] {
  const combined = (name + ' ' + tags.join(' ')).toLowerCase();
  const cats: MealCategory[] = [];

  if (combined.includes('奶茶') || combined.includes('茶') || combined.includes('咖啡') || combined.includes('拿铁') || combined.includes('饮品') || combined.includes('甜品') || combined.includes('果茶')) {
    cats.push('tea');
  }
  if (combined.includes('包子') || combined.includes('豆浆') || combined.includes('粥') || combined.includes('早茶') || combined.includes('煎饼') || combined.includes('三明治') || combined.includes('早餐')) {
    cats.push('breakfast');
  }
  if (combined.includes('串串') || combined.includes('烧烤') || combined.includes('大排档') || combined.includes('宵夜') || combined.includes('夜宵') || combined.includes('小龙虾')) {
    cats.push('night');
  }

  // 默认正餐
  if (cats.length === 0 || (!combined.includes('奶茶') && !combined.includes('咖啡'))) {
    cats.push('lunch', 'dinner');
  }

  return Array.from(new Set(cats));
}

/**
 * 智能解析多行批量菜单文本
 */
export function parseBatchLocationsText(rawText: string): ParsedLocationItem[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/);
  const results: ParsedLocationItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    let name = '';
    let tags: string[] = [];
    let priceRange = '￥20-35';
    let recommendedDish = '';
    let address = '';

    const bracketMatch = trimmed.match(/^([^(（]+)[(（]([^)）]+)[)）]$/);
    if (bracketMatch) {
      name = bracketMatch[1].trim();
      const innerText = bracketMatch[2].trim();

      const parts = innerText.split(/[|丨]/);
      for (const part of parts) {
        const item = part.trim();
        if (/^(标签[：:]|tags[：:]?)/i.test(item)) {
          const tagStr = item.replace(/^(标签[：:]|tags[：:]?)/i, '').trim();
          tags = tagStr.split(/[,，、\s]+/).filter(Boolean);
        } else if (/^(价格[：:]|人均[：:]?)/i.test(item)) {
          priceRange = item.replace(/^(价格[：:]|人均[：:]?)/i, '').trim();
        } else if (/^(推荐[：:]|招牌[：:]?)/i.test(item)) {
          recommendedDish = item.replace(/^(推荐[：:]|招牌[：:]?)/i, '').trim();
        } else if (/^(地址[：:]|位置[：:]|address[：:]?)/i.test(item)) {
          address = item.replace(/^(地址[：:]|位置[：:]|address[：:]?)/i, '').trim();
        } else if (!tags.length) {
          tags = item.split(/[,，、\s]+/).filter(Boolean);
        }
      }
    } else if (trimmed.includes('|') || trimmed.includes('丨')) {
      const parts = trimmed.split(/[|丨]/);
      name = parts[0].trim();
      if (parts[1]) {
        tags = parts[1].split(/[,，、\s]+/).filter(Boolean);
      }
      if (parts[2]) {
        priceRange = parts[2].trim();
      }
      if (parts[3]) {
        address = parts[3].trim();
      }
    } else {
      name = trimmed;
      tags = ['推荐美食'];
    }

    if (name) {
      const formattedTags = tags.length > 0 ? tags : ['推荐美食'];
      results.push({
        name,
        emoji: autoPickEmoji(name, formattedTags),
        tags: formattedTags,
        priceRange,
        recommendedDish,
        address: address || undefined,
        weight: 1,
        mealCategories: autoPickMealCategories(name, formattedTags),
      });
    }
  }

  return results;
}
