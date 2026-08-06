import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 内存 IP 简单限流 (1分钟内最多调用 8 次)
const ipRateMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientIP: string, limit = 8, windowMs = 60000): boolean {
  const now = Date.now();
  const record = ipRateMap.get(clientIP);

  if (!record || now > record.resetTime) {
    ipRateMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 客户端 IP 速率限制检测
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown-ip';
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', message: 'AI 调用过于频繁，请 1 分钟后再试！' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // ⚡ 关键修正：Request Body 在 Deno 中仅能消耗解析一次，统一解构所有参数
    const body = await req.json().catch(() => ({}));
    const { 
      action, 
      text, 
      locationName, 
      tags, 
      recommendedDish, 
      mealCategory,
      recordsSummary,
      totalCost,
      monthlyBudget,
      location1,
      location2,
      dishName,
      imageText
    } = body || {};

    // 1. 场景 1: AI 智能解析非结构化文本导入地点
    if (action === 'parse_location') {
      if (!text || typeof text !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Bad Request', message: '解析文本不能为空' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sanitizedText = text.slice(0, 500);

      const systemPrompt = `你是一个智能美食数据解析助手。请将用户输入的关于餐厅/美食的散乱介绍、微信推荐文案或小票文字，解析为标准的纯 JSON 对象。
必须仅返回 JSON，格式如下：
{
  "name": "餐厅名称",
  "emoji": "一个最匹配该餐厅/食物风格的 Emoji 图标",
  "tags": ["标签1", "标签2"],
  "priceRange": "预估人均价格，例如 ￥25-40",
  "recommendedDish": "招牌或推荐菜品"
}
绝对不要包含 markdown 格式标记或额外多余文字。`;

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

    // 3. 场景 3: AI “周周便当”每周饮食总结与健康省钱周报
    if (action === 'weekly_report') {
      const systemPrompt = `你是一位精明幽默的“周周便当”饮食与财务顾问大师。请根据用户近期的打卡记录与消费统计，生成一份趣味卡片式周报 JSON。
必须仅返回 JSON，格式如下：
{
  "title": "吃货称号（如：重口味碳水战士 / 极致省钱小能手 / 甜品解压大师）",
  "habitAnalysis": "对用户饮食偏好和频次的幽默点评（60字左右）",
  "healthInsight": "营养与口味均衡建议（50字左右）",
  "budgetInsight": "结合消费与预算的理财小提示（50字左右）"
}
绝对不要包含 markdown 格式标记或额外多余文字。`;

      const userMessage = `近打卡明细：${JSON.stringify(recordsSummary || [])}，阶段总花费：￥${totalCost || 0}，月度预算：${monthlyBudget ? `￥${monthlyBudget}` : '未设置'}`;

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
          temperature: 0.5,
          response_format: { type: 'json_object' }
        }),
      });

      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content || '{}';
      let reportJson = {};
      try {
        reportJson = JSON.parse(resultText);
      } catch (e) {
        reportJson = {
          title: '终极美食探险家',
          habitAnalysis: '本周打卡丰富多元，每一餐都充满了对生活的热爱！',
          healthInsight: '注意荤素搭配，多喝水，保持充沛活力。',
          budgetInsight: '开销合理，继续保持理智而美味的饮食节奏！'
        };
      }

      return new Response(
        JSON.stringify({ success: true, report: reportJson }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. 场景 4: AI “救救纠结症”双店 PK 辩论
    if (action === 'food_debate') {
      const loc1Name = location1?.name || '选项 A';
      const loc2Name = location2?.name || '选项 B';

      const systemPrompt = `你是一个美食辩论裁判。请让两位评委【热量快乐派】与【健康减脂派】针对两个餐厅选项展开 3 轮幽默互掐辩论，最后裁判给出结论。
必须仅返回 JSON，格式如下：
{
  "rounds": [
    { "speaker": "热量快乐派", "point": "辩词（40字左右）" },
    { "speaker": "健康减脂派", "point": "辩词（40字左右）" },
    { "speaker": "热量快乐派", "point": "辩词（40字左右）" },
    { "speaker": "健康减脂派", "point": "辩词（40字左右）" }
  ],
  "winner": "${loc1Name} 或 ${loc2Name}",
  "verdict": "裁判裁决理由（50字左右）"
}
绝对不要包含 markdown 格式标记或额外多余文字。`;

      const userMessage = `对比地点1：${loc1Name} (${(location1?.tags || []).join(',')})，对比地点2：${loc2Name} (${(location2?.tags || []).join(',')})`;

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
          response_format: { type: 'json_object' }
        }),
      });

      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content || '{}';
      let debateJson = {};
      try {
        debateJson = JSON.parse(resultText);
      } catch (e) {
        debateJson = {
          rounds: [
            { speaker: '热量快乐派', point: `果断选 ${loc1Name}！快乐才是无价的！` },
            { speaker: '健康减脂派', point: `保持理智，${loc2Name} 负担更轻更健康！` }
          ],
          winner: loc1Name,
          verdict: '经过激辩，今日遵从内心直觉吃更爽快的这家！'
        };
      }

      return new Response(
        JSON.stringify({ success: true, debateData: debateJson }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. 场景 5: 一人食 15分钟 AI 简易快手菜谱
    if (action === 'generate_recipe') {
      const targetDish = dishName || imageText || '特色快手菜';

      const systemPrompt = `你是一位极简快手菜大厨。请为给定的菜名或食材，输出一份【一人食 15分钟极简菜谱】JSON。
必须仅返回 JSON，格式如下：
{
  "title": "菜品名称",
  "difficulty": "简单 / 极简 / 有手就行",
  "cookTime": "10-15分钟",
  "ingredients": ["食材1 (用量)", "食材2 (用量)", "调料 (适量)"],
  "steps": ["步骤1说明", "步骤2说明", "步骤3说明"],
  "chefTips": "大厨避坑秘诀（30字以内）"
}
绝对不要包含 markdown 格式标记或额外多余文字。`;

      const userMessage = `目标菜品或识别文本：${targetDish.slice(0, 300)}`;

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
          max_tokens: 450,
          temperature: 0.5,
          response_format: { type: 'json_object' }
        }),
      });

      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content || '{}';
      let recipeJson = {};
      try {
        recipeJson = JSON.parse(resultText);
      } catch (e) {
        recipeJson = {
          title: targetDish,
          difficulty: '极简',
          cookTime: '15分钟',
          ingredients: ['主料 200g', '盐 适量', '食用油 1勺'],
          steps: ['食材洗净切块', '热锅下油翻炒至熟透', '出锅前撒少许调味料即可'],
          chefTips: '大火快炒锁住鲜味！'
        };
      }

      return new Response(
        JSON.stringify({ success: true, recipe: recipeJson }),
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
