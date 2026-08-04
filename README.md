# 🍱 周周便当 (WeeklyBento)

一款移动端优先、风格趣味、基于 Vue 3 的随机午餐选择应用。彻底解决“今天吃什么”的选择困难症！

---

## 🌟 核心特性

- 🎲 **趣味 Slot Machine 老虎机**：包含分类/口味、地点 Emoji 和吃货运势三轨滚动抽签。
- 🎵 **原生 Web Audio API 音效**：无外部音频依赖，转动喀哒声、按键声与中奖欢呼。
- 🎉 **Canvas 撒花特效**：中奖时触发全屏中奖彩带。
- 🔄 **轮次不重复机制**：已抽中的地点自动移出待抽池，直至全吃过一遍或管理员手动重置。
- ☁️ **全云端存储 (免自建后端)**：基于环境变量直连 **JSONBin.io** 云数据库，数据自动跨设备（手机/电脑）实时同步。
- 🔑 **管理员控制台 (密码保护)**：
  - 默认初始密码：`admin888`
  - 隐秘暗门：连续点击 Logo 或右上角图标输入密码解锁。
  - 地点池管理：新增、编辑、删除地点、标签、预算、推荐菜，或恢复预设地点。
  - 历史记录管理：日历查看与修改每日用餐打卡。
  - **安全隐蔽**：云端 Key 与 Endpoint 托管于 `.env` 环境变量，打包打包后直接带入，在管理员界面**禁止查看与修改明文密钥**。

---

## 🛠️ 本地调试与打包命令

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

---

## ☁️ 环境变量配置 (.env)

项目根目录下的 `.env` 文件包含 JSONBin 云数据库凭据（项目打包时会自动内嵌到应用代码中）：

```env
# JSONBin 云数据库配置
VITE_JSONBIN_API_URL=https://api.jsonbin.io/v3/b/xxxxxxxxxxxxxxxx
VITE_JSONBIN_API_KEY=$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 📖 JSONBin.io 账号及 Bin / Key 申请详细流程

如果你想创建属于自己的独立 JSONBin 云存储，可以按照以下步骤申请：

### 1. 注册并登录
访问 [https://jsonbin.io](https://jsonbin.io)，点击右上角 **Log In / Sign Up**，推荐直接使用 **GitHub / Google** 账号一键登录。

### 2. 获取 API Key (Master Key / Access Key)
1. 登录后打开左侧菜单栏 **API Keys**（或访问 [https://jsonbin.io/app/api-keys](https://jsonbin.io/app/api-keys)）。
2. 你可以使用页面中默认生成的 **Master Key**，或者在 **Access Keys** 中新建专用的 **Access Key**（格式形如：`$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`）。项目已同时兼容 `X-Master-Key` 与 `X-Access-Key` 请求头。

### 3. 创建数据 Bin
1. 点击左侧菜单栏 **Bins** ➔ **Create Bin**。
2. 在 JSON 代码编辑框中粘贴以下初始化结构：
   ```json
   {
     "locations": [],
     "records": []
   }
   ```
3. 选项保留为 **Private**（私有库保护隐私），点击右下角 **Create** 提交。
4. 提交后页面顶部会生成对应的 **Bin ID**（例如 `66b1a2c3e4b0123456789abc`）。
5. 你的 **API Endpoint** 格式即为：
   ```text
   https://api.jsonbin.io/v3/b/<你的Bin_ID>
   ```

### 4. 替换环境变量
将上述申请到的 **API Endpoint** 和 **Master Key** 填写到项目的 `.env` 文件中即可：
```env
VITE_JSONBIN_API_URL=https://api.jsonbin.io/v3/b/<你的Bin_ID>
VITE_JSONBIN_API_KEY=<你的Master_Key>
```

---

## 📁 项目目录结构

```
WeeklyBento/
├── .env                        # 项目环境变量 (JSONBin 云数据库 URL & Key)
├── index.html                  # Viewport 移动端适配与 HTML 入口
├── package.json                # 项目依赖与运行脚本
├── vite.config.ts              # Vite 构建配置
├── README.md                   # 项目使用与申请说明文档
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
