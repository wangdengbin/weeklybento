# 🍱 周周便当 (WeeklyBento)

一款移动端优先、风格趣味、基于 Vue 3 的随机午餐选择应用。彻底解决“今天吃什么”的选择困难症！

---

## 🌟 核心特性

- 🎲 **趣味 Slot Machine 老虎机**：包含分类/口味、地点 Emoji 和吃货运势三轨滚动抽签。
- 🎵 **原生 Web Audio API 音效**：无外部音频依赖，转动喀哒声、按键声与中奖欢呼。
- 🎉 **Canvas 撒花特效**：中奖时触发全屏中奖彩带。
- 🔄 **轮次不重复机制**：已抽中的地点自动移出待抽池，直至全吃过一遍或管理员手动重置。
- 👥 **Supabase 团队空间**：团队菜单、邀请成员、角色权限与抽签结果实时同步，支持独立分享链接。
- 🔑 **管理员控制台 (密码保护)**：
  - 默认初始密码：`admin888`
  - 隐秘暗门：连续点击 Logo 或右上角图标输入密码解锁。
  - 地点池管理：新增、编辑、删除地点、标签、预算、推荐菜，或恢复预设地点。
  - 历史记录管理：日历查看与修改每日用餐打卡。
  - 团队权限由 Supabase Auth 与 RLS 控制，所有者和管理员才能修改团队菜单。

- 🌐 **在线访问体验**：[https://wangdengbin.github.io/weeklybento/](https://wangdengbin.github.io/weeklybento/)

---

## 🛠️ 本地调试与部署命令

### 1. 安装依赖
```bash
npm install
```

### 2. 本地开发调试
```bash
npm run dev
```
启动后在浏览器中访问 `http://localhost:5173/`。

### 3. 项目生产打包
```bash
npm run build
```
打包生成的可部署静态资源存放在 `dist/` 目录中。

### 4. 预览打包结果
```bash
npm run preview
```

### 5. 一键发布部署至 GitHub Pages
```bash
npm run deploy
```
该命令会自动构建项目，并直接把 `dist/` 产物推送到远程 `gh-pages` 分支完成在线发布。

### 6. 发布 GitHub Releases 版本
```bash
# 1. 打上版本号标签 (例如 v1.0.0)
git tag -a v1.0.0 -m "v1.0.0 首次正式版本发布"

# 2. 将标签推送到远程仓库
git push origin v1.0.0
```
推送完成后，打开 [https://github.com/wangdengbin/weeklybento/releases](https://github.com/wangdengbin/weeklybento/releases) 点击 **Draft a new release**，选择 `v1.0.0` 标签并填写更新说明即可发布 Release。



---

## ☁️ Supabase 配置

1. 在 Supabase 创建项目。
2. 打开 **Authentication -> Sign In / Providers**，找到 **Anonymous** 并勾选启用匿名登录（Enable Anonymous sign-ins）。
3. 打开 **SQL Editor**，完整执行 [`supabase/schema.sql`](supabase/schema.sql)。
4. 从 **Project Settings -> API** 获取项目 URL 和公开的 publishable/anon key。
5. 创建 `.env`：

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

`anon key` 可以出现在前端构建产物中；不要在前端使用 `service_role key`。实际数据权限由 `schema.sql` 中的 RLS 策略控制。

团队邀请链接包含团队 ID 和可轮换的邀请码。详细的后台用户活跃监控及数据统计 SQL 查询可参考 [Supabase 后台用户与数据监控指南](doc/SUPABASE_ADMIN_AND_USERS.md)。

---

## 📁 项目目录结构

```
WeeklyBento/
├── .env                        # Supabase URL 与公开 anon key
├── index.html                  # Viewport 移动端适配与 HTML 入口
├── package.json                # 项目依赖与运行脚本
├── vite.config.ts              # Vite 构建配置
├── README.md                   # 项目使用与部署说明
├── doc/                        # 项目详细文档目录
│   ├── GAMEPLAY_AND_RULES.md   # 核心玩法规则与技术复盘文档
│   └── SUPABASE_ADMIN_AND_USERS.md # Supabase 后台用户与数据监控指南
├── supabase/schema.sql         # 团队数据表、RLS、RPC 与 Realtime 配置
└── src/
    ├── main.ts                 # Vue 3 入口
    ├── App.vue                 # 主应用视图与数据挂载
    ├── assets/
    │   └── main.css            # 动态便当主题与动画样式
    ├── components/
    │   ├── HeaderNav.vue       # 头部 Navigation & 管理员暗门
    │   ├── SlotMachine.vue     # 趣味抽签老虎机主组件
    │   ├── ResultModal.vue     # 抽中结果卡片 modal
    │   ├── HistoryView.vue     # 每日午餐打卡历史与编辑
    │   ├── AdminModal.vue      # 管理员登录框
    │   └── AdminPanel.vue      # 管理员后台面板 (地点管理/安全)
    ├── composables/
    │   ├── useBentoStore.ts    # 核心数据 Store
    │   ├── useCloudSync.ts     # 云数据库即时同步逻辑
    │   ├── useAdmin.ts         # 管理员鉴权与密码管理
    │   └── useAudio.ts         # Web Audio 纯原生音效合成
    └── types/
        └── index.ts            # TypeScript 接口定义
```

---

## 📄 开源许可

[MIT License](LICENSE)
