# 📊 Supabase 后台用户与数据监控指南 (Supabase Admin & User Guide)

本文档用于指导管理员如何在 Supabase 后台查看用户活跃度、分析团队使用状态以及执行高效的 SQL 统计查询。

---

## 🔍 方法 1：在 Supabase Dashboard 界面可视化查看

### 1. 查看所有登录/游客用户 (`Authentication ➔ Users`)
1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) 并选择你的项目。
2. 在左侧菜单点击 **Authentication ➔ Users**：
   * **用户列表**：罗列所有已注册账户（邮箱）及游客（Anonymous）账户。
   * **Email / Provider**：查看登录来源（`email` 邮箱注册 / `anonymous` 匿名游客）。
   * **User UID**：用户的专属唯一 UUID (`auth.uid()`)。
   * **Last Sign In（最后上线时间）**：直观了解用户最近一次打开应用或选餐的时间。
   * **Created At**：用户账户首次创建的时间。

### 2. 在数据表编辑器中查看业务状态 (`Table Editor`)
点击左侧 **Table Editor**，可直接筛选查看数据库实时表数据：

* **`teams` 表**：查看当前共创建了多少个午餐搭子圈（`name` 团队名称、`public_id` 团队号、`created_by` 创建者 UID）。
* **`team_members` 表**：查看哪些用户加入了哪些搭子圈，以及他们的权限角色（`owner` / `admin` / `member`）和加入时间 (`joined_at`)。
* **`team_locations` 表**：查看各团队录入的所有自定义地点、价格、推荐菜及权重。
* **`team_draws` 表**：查看每天有哪些团队在选餐打卡（`drawn_by` 为选餐操作人 ID，`drawn_at` 为选餐时间）。

---

## 💻 方法 2：在 SQL Editor 执行高效统计查询

点击左侧 **SQL Editor** 菜单，运行以下常用的管理与分析 SQL 脚本：

### 1. 查询近活跃的所有用户及其邮箱与上线时间
```sql
SELECT 
  id AS 用户ID,
  email AS 邮箱账号,
  COALESCE(is_anonymous, false) AS 是否游客,
  created_at AS 注册时间,
  last_sign_in_at AS 最后上线活跃时间
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST;
```

### 2. 查询完整团队列表及成员人数统计
```sql
SELECT 
  t.id AS 团队ID,
  t.public_id AS 团队搭子圈号,
  t.name AS 团队名称,
  COUNT(m.user_id) AS 成员总人数,
  t.created_at AS 创建时间
FROM public.teams t
LEFT JOIN public.team_members m ON m.team_id = t.id
GROUP BY t.id, t.public_id, t.name, t.created_at
ORDER BY t.created_at DESC;
```

### 3. 查询各团队详细成员邮箱及身份清单
```sql
SELECT 
  t.name AS 团队名称,
  t.public_id AS 团队号,
  COALESCE(u.email, '匿名成员') AS 成员邮箱,
  m.role AS 身份角色,
  m.joined_at AS 加入时间
FROM public.team_members m
JOIN public.teams t ON t.id = m.team_id
LEFT JOIN auth.users u ON u.id = m.user_id
ORDER BY m.joined_at DESC;
```

### 4. 查询团队选餐 Roll 记录与打卡热度
```sql
SELECT 
  t.name AS 团队名称,
  d.business_date AS 选餐日期,
  l.name AS 选中的地点,
  COALESCE(u.email, '团队成员') AS 操作人邮箱,
  d.drawn_at AS 操作时间
FROM public.team_draws d
JOIN public.teams t ON t.id = d.team_id
JOIN public.team_locations l ON l.id = d.location_id
LEFT JOIN auth.users u ON u.id = d.drawn_by
ORDER BY d.drawn_at DESC;
```
