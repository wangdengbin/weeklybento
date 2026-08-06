import { ref } from 'vue';
import { supabase } from '../lib/supabase';

export interface ParsedLocationResult {
  name: string;
  emoji: string;
  tags: string[];
  priceRange: string;
  recommendedDish?: string;
}

export function useBentoAI() {
  const isLoading = ref(false);
  const aiError = ref<string | null>(null);

  /**
   * 场景 1: AI 智能解析非结构化文本导入地点
   */
  async function parseLocationText(inputText: string): Promise<ParsedLocationResult | null> {
    if (!inputText || !inputText.trim()) {
      aiError.value = '请输入需要解析的文本内容';
      return null;
    }

    isLoading.value = true;
    aiError.value = null;

    try {
      if (!supabase) {
        throw new Error('Supabase 客户端未初始化，请检查环境配置');
      }

      const { data, error } = await supabase.functions.invoke('bento-ai', {
        body: {
          action: 'parse_location',
          text: inputText.trim(),
        },
      });

      if (error) {
        // 捕获 HTTP 429 速率限制
        if (error.status === 429 || error.message?.includes('429')) {
          throw new Error('AI 服务请求过于频繁，请稍后再试！');
        }
        throw new Error(error.message || 'AI 解析请求失败');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      return data.data as ParsedLocationResult;
    } catch (err: any) {
      console.error('[BentoAI Parse Error]:', err);
      aiError.value = err.message || 'AI 智能解析发生异常';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 场景 2: 生成 AI 食神点评 / 吃货运势
   */
  async function generateFoodReview(params: {
    locationName: string;
    tags?: string[];
    recommendedDish?: string;
    mealCategory?: string;
  }): Promise<string | null> {
    isLoading.value = true;
    aiError.value = null;

    try {
      if (!supabase) {
        throw new Error('Supabase 客户端未初始化');
      }

      const { data, error } = await supabase.functions.invoke('bento-ai', {
        body: {
          action: 'food_review',
          locationName: params.locationName,
          tags: params.tags || [],
          recommendedDish: params.recommendedDish || '',
          mealCategory: params.mealCategory || '',
        },
      });

      if (error) {
        if (error.status === 429 || error.message?.includes('429')) {
          throw new Error('食神打瞌睡中（触发 AI 调用频次限制），请稍后再试！');
        }
        throw new Error(error.message || '获取食神点评失败');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      return data.review || '食神签语：吃饱喝足，快乐百倍！';
    } catch (err: any) {
      console.error('[BentoAI Review Error]:', err);
      aiError.value = err.message || '获取食神点评失败';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading,
    aiError,
    parseLocationText,
    generateFoodReview,
  };
}
