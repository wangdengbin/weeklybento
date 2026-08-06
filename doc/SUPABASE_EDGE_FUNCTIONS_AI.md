# Supabase Edge Functions & DeepSeek AI 配置与云端部署指南

本项目通过 Supabase Edge Function (`bento-ai`) 实现基于 DeepSeek API 的 AI 能力，不仅零暴露 API Key，并且内置防盗刷速率保护。

---

## 🌟 AI 能力说明

1. **✨ AI 智能文本/小票识别导入** (地点表单中)：
   - 输入散乱文字（如：“昨天在科技园吃的小杨生煎，人均25，推荐鲜肉生煎”）。
   - AI 自动解析并填充店铺名称、Emoji、标签、人均预算和推荐菜品。
2. **🔮 AI 食神独家点评 & 吃货运势** (抽中结果弹窗中)：
   - 生成活泼幽默的今日吃货运势与菜品搭档建议。
3. **🛡️ 独立 IP 限流防护 (Rate Limiting)**：
   - 云函数中记录单 IP 的 AI 请求频率（1 分钟上限 8 次 AI 调用），超出拦截并返回 `429 Too Many Requests`。
   - 项目常规的数据库读写与数据同步不受此限制。

---

## ☁️ 方式一：Supabase 网页云端控制台部署 (推荐，无需本地 CLI)

### 1. 配置 DeepSeek API Key (Secret)
1. 登录 [Supabase Dashboard 管理后台](https://supabase.com/dashboard)，进入对应的 WeeklyBento 项目。
2. 点击左侧导航栏底部的 **Project Settings** (齿轮图标)。
3. 在设置中找到 **Edge Functions** (或 **Configuration -> Secrets**)。
4. 点击 **Add new secret**：
   - **Name (变量名)**：`DEEPSEEK_API_KEY`
   - **Value (变量值)**：填入你的 DeepSeek API Key（格式如 `sk-xxxxxxxxx`）
5. 点击 **Save** 保存。

### 2. 云端创建并粘贴 Edge Function 代码
1. 点击左侧导航栏的 **Edge Functions** 图标。
2. 点击右上角 **Create Function** 按钮，函数名称填写：`bento-ai`。
3. 打开本地项目文件 [`supabase/functions/bento-ai/index.ts`](../supabase/functions/bento-ai/index.ts)，复制文件中的**所有内容**。
4. 粘贴到网页端的代码编辑器中。
5. 点击右上角的 **Deploy** 按钮，完成发布。

---

## 🛠️ 方式二：使用 Supabase CLI 本地命令行部署

如果你习惯使用命令行终端，可在项目根目录下运行以下命令：

```bash
# 1. 登录 Supabase 账号
npx supabase login

# 2. 绑定 DeepSeek API Key 到云端环境变量
npx supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 3. 一键部署 bento-ai 云函数
npx supabase functions deploy bento-ai --no-verify-jwt
```

---

## 🧪 调试与测试

部署完成后，前端应用通过 Supabase SDK 的 `supabase.functions.invoke('bento-ai', { body })` 发起调用。若未配置 API Key 或触发速率限制，系统会在前端显示友好的中文提示。
