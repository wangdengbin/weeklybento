import { ref } from 'vue';
import { supabase } from '../lib/supabase';

export interface ParsedLocationResult {
  name: string;
  emoji: string;
  tags: string[];
  priceRange: string;
  recommendedDish?: string;
}

export interface WeeklyReportResult {
  title: string;
  habitAnalysis: string;
  healthInsight: string;
  budgetInsight: string;
}

export interface DebateSpeakerItem {
  speaker: string;
  avatar: string;
  content: string;
}

export interface FoodDebateResult {
  debate: DebateSpeakerItem[];
  winner: string;
  verdict: string;
}

export interface RecipeIngredientItem {
  name: string;
  amount: string;
}

export interface RecipeResult {
  dishName: string;
  difficulty: string;
  servings: string;
  ingredients: RecipeIngredientItem[];
  steps: string[];
  chefTips: string;
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

  /**
   * 场景 3: AI “周周便当”饮食周报生成
   */
  async function generateWeeklyReport(recordsSummary: Array<{ name: string; cost?: number; category?: string; tags?: string[] }>, totalCost: number, monthlyBudget?: number): Promise<WeeklyReportResult | null> {
    isLoading.value = true;
    aiError.value = null;

    try {
      if (!supabase) {
        throw new Error('Supabase 客户端未初始化');
      }

      const { data, error } = await supabase.functions.invoke('bento-ai', {
        body: {
          action: 'weekly_report',
          recordsSummary,
          totalCost,
          monthlyBudget,
        },
      });

      if (error) {
        if (error.status === 429 || error.message?.includes('429')) {
          throw new Error('AI 服务调用频次超限，请稍后再生成周报！');
        }
        throw new Error(error.message || '生成 AI 周报失败');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      return data.report as WeeklyReportResult;
    } catch (err: any) {
      console.error('[BentoAI Weekly Report Error]:', err);
      aiError.value = err.message || '生成 AI 饮食周报发生异常';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 场景 4: AI “救救纠结症”双店 PK 辩论
   */
  async function generateFoodDebate(location1: { name: string; tags?: string[] }, location2: { name: string; tags?: string[] }): Promise<FoodDebateResult | null> {
    isLoading.value = true;
    aiError.value = null;

    try {
      if (!supabase) {
        throw new Error('Supabase 客户端未初始化');
      }

      const { data, error } = await supabase.functions.invoke('bento-ai', {
        body: {
          action: 'food_debate',
          location1,
          location2,
        },
      });

      if (error) {
        if (error.status === 429 || error.message?.includes('429')) {
          throw new Error('辩论评委正在喝水（触发 AI 频率限制），请稍后再试！');
        }
        throw new Error(error.message || 'AI 美食辩论请求失败');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      return data.debateData as FoodDebateResult;
    } catch (err: any) {
      console.error('[BentoAI Debate Error]:', err);
      aiError.value = err.message || '生成 AI 双店辩论发生异常';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 场景 5: 生成一人食 15分钟 AI 简易快手菜谱
   */
  async function generateRecipe(dishName: string, imageText?: string): Promise<RecipeResult | null> {
    isLoading.value = true;
    aiError.value = null;

    try {
      if (!supabase) {
        throw new Error('Supabase 客户端未初始化');
      }

      const { data, error } = await supabase.functions.invoke('bento-ai', {
        body: {
          action: 'generate_recipe',
          dishName: dishName.trim(),
          imageText: imageText || '',
        },
      });

      if (error) {
        if (error.status === 429 || error.message?.includes('429')) {
          throw new Error('大厨正在休息（触发 AI 频率限制），请稍后再试！');
        }
        throw new Error(error.message || '生成 AI 菜谱失败');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      return data.recipe as RecipeResult;
    } catch (err: any) {
      console.error('[BentoAI Recipe Error]:', err);
      aiError.value = err.message || '生成 AI 简易菜谱发生异常';
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
    generateWeeklyReport,
    generateFoodDebate,
    generateRecipe,
  };
}
