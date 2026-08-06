import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 内存速率限制表（基于 IP 限制 AI 调用）
// 规则：单个 IP 1 分钟内最多允许 8 次 AI 请求
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_AI_REQUESTS_PER_WINDOW = 8;
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const record = ipRequestCounts.get(clientIp);

  if (!record || now > record.resetTime) {
    ipRequestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_AI_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count += 1;
  return false;
}

serve(async (req) => {
  // 处理 OPTIONS 跨域预检
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 提取客户端 IP（仅对 AI 调用进行速率限制）
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown_ip';
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded', 
          message: 'AI 服务调用过于频繁，食神打瞌睡中，请 1 分钟后再试哦！' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 从环境变量中获取 DeepSeek API Key
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration Error', message: '服务端未配置 DEEPSEEK_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, text, locationName, tags, recommendedDish, mealCategory } = await req.json();

    // 1. 场景 1: AI 智能解析非结构化文本导入地点
    if (action === 'parse_location') {
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Bad Request', message: '解析文本不能为空' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 截断文本防耗尽 Token (上限 500 字符)
      const sanitizedText = text.slice(0, 500);

      const systemPrompt = `你是一个智能美食数据解析助手。请将用户输入的关于餐厅/美食的散乱介绍、微信推荐文案或小票文字，解析为标准的纯 JSON 对象。
必须仅返回 JSON，格式如下：
{
  "name": "餐厅名称",
  "emoji": "一个最匹配该餐厅/食物风格的 Emoji 图标",
  "tags": ["标签1", "标签2", "标签3"],
  "priceRange": "人均预算，如 ￥25-40 或 ￥30",
  "recommendedDish": "推荐菜品或招牌菜"
}
如果某些信息未提及，请合理推断补充简短标签或通用 Emoji。绝对不要包含 markdown 格式标记或其他多余话语。`;

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: sanitizedText },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        }),
      });

      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content || '{}';
      let parsedJson = {};
      try {
        parsedJson = JSON.parse(resultText);
      } catch (e) {
        parsedJson = { name: text.slice(0, 10), emoji: '🍱', tags: ['好味'], priceRange: '￥25', recommendedDish: '' };
      }

      return new Response(
        JSON.stringify({ success: true, data: parsedJson }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. 场景 2: AI 食神点评 / 吃货运势
    if (action === 'food_review') {
      const locName = locationName || '随机美食';
      const locTags = Array.isArray(tags) ? tags.join('、') : '';
      const dish = recommendedDish ? `（推荐菜：${recommendedDish}）` : '';
      const category = mealCategory || '午餐';

      const systemPrompt = `你是一位风趣幽默、擅长饮食心理学的美食食神与运势大师。
请为用户抽中的用餐地点生成一段【今日食神点评 & 吃货运势】（80字以内）。
要求：
1. 语气活泼幽默、接地气。
2. 包含一个今日吃货运势小建议或“食神推荐搭档”。
3. 结合当前的餐池类型（如午餐/奶茶/晚餐）。
不要打招呼，直接输出点评正文。`;

      const userMessage = `抽中地点：${locName}${dish}，类型标签：${locTags}，餐池：${category}`;

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      const reviewText = data.choices?.[0]?.message?.content || '食神今日签语：饱餐一顿，万事顺遂！';

      return new Response(
        JSON.stringify({ success: true, review: reviewText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Bad Request', message: '未知的 action 指令' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Internal Error', message: err.message || '服务器内部异常' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
