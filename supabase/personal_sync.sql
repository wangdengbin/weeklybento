-- =====================================================================
-- 个人模式云同步（个人账单 / 地点池 / 设置 / 删除墓碑）
-- 适用场景：个人模式数据跨设备同步，按 Supabase 登录用户(user_id)隔离
-- 本文件可重复执行（幂等），在 Supabase SQL Editor 中整段运行即可
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 个人地点池（与前端 BentoLocation 对齐）
-- ---------------------------------------------------------------------
create table if not exists public.user_locations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 80),
  emoji text not null default '🍚',
  tags text[] not null default '{}',
  price_range text not null default '',
  recommended_dish text,
  weight integer not null default 1,
  is_drawn boolean not null default false,
  visible boolean not null default true,
  meal_categories text[],
  address text,
  map_url text,
  created_at_ms bigint not null default 0,
  updated_at_ms bigint not null default 0,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------
-- 2. 个人账单/打卡记录（与前端 DailyRecord 对齐，cost 即账单金额）
-- ---------------------------------------------------------------------
create table if not exists public.user_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date text not null,
  meal_category text,
  status text not null default 'confirmed',
  location_id text,
  location_name text,
  emoji text default '🍚',
  tags text[] not null default '{}',
  drawn_at text,
  note text,
  cost numeric,
  address text,
  map_url text,
  updated_at_ms bigint not null default 0,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------
-- 3. 个人设置（每用户一行 jsonb）
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at_ms bigint not null default 0
);

-- ---------------------------------------------------------------------
-- 4. 删除墓碑：跨设备正确传播“删除”动作，避免已删除记录复活
-- ---------------------------------------------------------------------
create table if not exists public.user_deletions (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('record', 'location')),
  id text not null,
  deleted_at_ms bigint not null default 0,
  primary key (user_id, kind, id)
);

-- ---------------------------------------------------------------------
-- 索引
-- ---------------------------------------------------------------------
create index if not exists user_locations_user_idx on public.user_locations(user_id);
create index if not exists user_records_user_idx on public.user_records(user_id);
create index if not exists user_records_date_idx on public.user_records(user_id, date desc);
create index if not exists user_deletions_user_idx on public.user_deletions(user_id);

-- ---------------------------------------------------------------------
-- RLS：仅允许本人读写
-- ---------------------------------------------------------------------
alter table public.user_locations enable row level security;
alter table public.user_records enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_deletions enable row level security;

drop policy if exists "user locations select" on public.user_locations;
drop policy if exists "user locations insert" on public.user_locations;
drop policy if exists "user locations update" on public.user_locations;
drop policy if exists "user locations delete" on public.user_locations;
create policy "user locations select" on public.user_locations for select using (user_id = auth.uid());
create policy "user locations insert" on public.user_locations for insert with check (user_id = auth.uid());
create policy "user locations update" on public.user_locations for update using (user_id = auth.uid());
create policy "user locations delete" on public.user_locations for delete using (user_id = auth.uid());

drop policy if exists "user records select" on public.user_records;
drop policy if exists "user records insert" on public.user_records;
drop policy if exists "user records update" on public.user_records;
drop policy if exists "user records delete" on public.user_records;
create policy "user records select" on public.user_records for select using (user_id = auth.uid());
create policy "user records insert" on public.user_records for insert with check (user_id = auth.uid());
create policy "user records update" on public.user_records for update using (user_id = auth.uid());
create policy "user records delete" on public.user_records for delete using (user_id = auth.uid());

drop policy if exists "user settings select" on public.user_settings;
drop policy if exists "user settings insert" on public.user_settings;
drop policy if exists "user settings update" on public.user_settings;
drop policy if exists "user settings delete" on public.user_settings;
create policy "user settings select" on public.user_settings for select using (user_id = auth.uid());
create policy "user settings insert" on public.user_settings for insert with check (user_id = auth.uid());
create policy "user settings update" on public.user_settings for update using (user_id = auth.uid());
create policy "user settings delete" on public.user_settings for delete using (user_id = auth.uid());

drop policy if exists "user deletions select" on public.user_deletions;
drop policy if exists "user deletions insert" on public.user_deletions;
drop policy if exists "user deletions update" on public.user_deletions;
drop policy if exists "user deletions delete" on public.user_deletions;
create policy "user deletions select" on public.user_deletions for select using (user_id = auth.uid());
create policy "user deletions insert" on public.user_deletions for insert with check (user_id = auth.uid());
create policy "user deletions update" on public.user_deletions for update using (user_id = auth.uid());
create policy "user deletions delete" on public.user_deletions for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 权限：仅 authenticated（含匿名登录会话）可访问
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.user_locations to authenticated;
grant select, insert, update, delete on public.user_records to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.user_deletions to authenticated;
revoke all on public.user_locations from anon;
revoke all on public.user_records from anon;
revoke all on public.user_settings from anon;
revoke all on public.user_deletions from anon;

-- ---------------------------------------------------------------------
-- Realtime（可选）：加入发布便于后续多端实时刷新
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.user_locations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_records;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.user_deletions;
exception when duplicate_object then null;
end $$;
