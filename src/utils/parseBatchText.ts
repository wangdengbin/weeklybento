export interface ParsedLocationItem {
  name: string;
  emoji: string;
  tags: string[];
  priceRange: string;
  recommendedDish?: string;
  weight: number;
}

/**
 * 自动根据名称与标签关键词识别匹配合适 Emoji
 */
export function autoPickEmoji(name: string, tags: string[]): string {
  const combined = (name + ' ' + tags.join(' ')).toLowerCase();

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
 * 智能解析多行批量菜单文本
 * 支持格式示例：
 * 1. 汆悦麻辣烫 （标签：麻辣烫, 自选, 汤底）
 * 2. 丰香园 (标签: 中餐炒菜, 炒菜)
 * 3. 刘一手 | 自助菜, 快餐 | ￥20-30
 * 4. 平安美食城
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

    // 正则提取括号内的 标签：xxx 或 标签: xxx
    const bracketMatch = trimmed.match(/^([^(（]+)[(（]([^)）]+)[)）]$/);
    if (bracketMatch) {
      name = bracketMatch[1].trim();
      const innerText = bracketMatch[2].trim();

      // 解析括号内部内容 (可能包含 标签：xxx | 价格：xxx | 推荐：xxx)
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
        } else if (!tags.length) {
          // 如果没有带"标签："前缀，直接按逗号切分当做标签
          tags = item.split(/[,，、\s]+/).filter(Boolean);
        }
      }
    } else if (trimmed.includes('|') || trimmed.includes('丨')) {
      // 管道符分隔格式：地点名称 | 标签1, 标签2 | ￥20-35
      const parts = trimmed.split(/[|丨]/);
      name = parts[0].trim();
      if (parts[1]) {
        tags = parts[1].split(/[,，、\s]+/).filter(Boolean);
      }
      if (parts[2]) {
        priceRange = parts[2].trim();
      }
    } else {
      // 纯文本单行：只包含地点名称
      name = trimmed;
      tags = ['推荐美食'];
    }

    if (name) {
      results.push({
        name,
        emoji: autoPickEmoji(name, tags),
        tags: tags.length > 0 ? tags : ['推荐美食'],
        priceRange,
        recommendedDish,
        weight: 1,
      });
    }
  }

  return results;
}
