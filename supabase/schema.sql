create extension if not exists pgcrypto;

-- 本脚本完全幂等：无论全新或已有数据库，都可重复完整执行。
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default encode(gen_random_bytes(6), 'hex'),
  name text not null check (char_length(name) between 1 and 40),
  invite_token_hash text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.team_locations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  emoji text not null default '🍱',
  tags text[] not null default '{}',
  price_range text not null default '',
  recommended_dish text,
  weight integer not null default 1 check (weight between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.team_draws (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  location_id uuid not null references public.team_locations(id) on delete cascade,
  business_date date not null default current_date,
  drawn_by uuid not null references auth.users(id),
  drawn_at timestamptz not null default now(),
  note text,
  unique (team_id, business_date)
);

create index if not exists team_locations_team_id_idx on public.team_locations(team_id);
create index if not exists team_draws_team_date_idx on public.team_draws(team_id, business_date desc);
create index if not exists team_members_user_id_idx on public.team_members(user_id);

create or replace function public.is_team_member(target_team_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from team_members where team_id = target_team_id and user_id = auth.uid());
$$;

create or replace function public.can_manage_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = target_team_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_locations enable row level security;
alter table public.team_draws enable row level security;

drop policy if exists "members read teams" on public.teams;
create policy "members read teams" on public.teams for select using (public.is_team_member(id));
drop policy if exists "owners delete teams" on public.teams;
create policy "owners delete teams" on public.teams for delete using (
  exists (
    select 1 from team_members
    where team_id = id and user_id = auth.uid() and role = 'owner'
  )
);
drop policy if exists "members read memberships" on public.team_members;
create policy "members read memberships" on public.team_members for select using (public.is_team_member(team_id));
drop policy if exists "members delete self membership" on public.team_members;
create policy "members delete self membership" on public.team_members for delete using (user_id = auth.uid());
drop policy if exists "members read locations" on public.team_locations;
create policy "members read locations" on public.team_locations for select using (public.is_team_member(team_id));
drop policy if exists "members insert locations" on public.team_locations;
create policy "members insert locations" on public.team_locations for insert with check (public.is_team_member(team_id));
drop policy if exists "members update locations" on public.team_locations;
create policy "members update locations" on public.team_locations for update using (public.is_team_member(team_id));
drop policy if exists "members delete locations" on public.team_locations;
create policy "members delete locations" on public.team_locations for delete using (public.is_team_member(team_id));
drop policy if exists "members read draws" on public.team_draws;
create policy "members read draws" on public.team_draws for select using (public.is_team_member(team_id));
drop policy if exists "members insert draws" on public.team_draws;
create policy "members insert draws" on public.team_draws for insert with check (public.is_team_member(team_id));
drop policy if exists "members update draws" on public.team_draws;
create policy "members update draws" on public.team_draws for update using (public.is_team_member(team_id));
drop policy if exists "members delete draws" on public.team_draws;
create policy "members delete draws" on public.team_draws for delete using (public.is_team_member(team_id));

create or replace function public.create_team(p_name text, p_locations jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  new_team teams;
  invite_token text := encode(gen_random_bytes(18), 'hex');
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if char_length(trim(p_name)) not between 1 and 40 then raise exception 'invalid team name'; end if;

  -- 匿名用户无法使用团队功能
  if (select coalesce((raw_app_meta_data->>'provider') = 'anonymous' or (is_anonymous is true), false) from auth.users where id = auth.uid()) then
    raise exception '匿名账户无法使用团队功能，请先登录或绑定正式邮箱账号 (anonymous users cannot use team features)';
  end if;

  -- 增加单账户最多 3 个团队配额校验
  if (select count(*) from team_members where user_id = auth.uid()) >= 3 then
    raise exception '已达到单账户最多 3 个团队的上限 (team count limit reached max 3)';
  end if;

  insert into teams (name, invite_token_hash, created_by)
  values (trim(p_name), encode(digest(invite_token, 'sha256'), 'hex'), auth.uid())
  returning * into new_team;
  insert into team_members (team_id, user_id, role) values (new_team.id, auth.uid(), 'owner');

  insert into team_locations (team_id, name, emoji, tags, price_range, recommended_dish, weight)
  select new_team.id,
         left(coalesce(item->>'name', '未命名地点'), 80),
         coalesce(nullif(item->>'emoji', ''), '🍱'),
         coalesce(array(select jsonb_array_elements_text(coalesce(item->'tags', '[]'::jsonb))), '{}'),
         coalesce(item->>'priceRange', ''),
         nullif(item->>'recommendedDish', ''),
         greatest(1, least(100, coalesce((item->>'weight')::integer, 1)))
  from jsonb_array_elements(coalesce(p_locations, '[]'::jsonb)) item;

  return jsonb_build_object('id', new_team.id, 'public_id', new_team.public_id,
    'name', new_team.name, 'role', 'owner', 'invite_token', invite_token);
end;
$$;

create or replace function public.join_team(p_public_id text, p_invite_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  target teams;
  member_role text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  -- 匿名用户无法使用团队功能
  if (select coalesce((raw_app_meta_data->>'provider') = 'anonymous' or (is_anonymous is true), false) from auth.users where id = auth.uid()) then
    raise exception '匿名账户无法使用团队功能，请先登录或绑定正式邮箱账号 (anonymous users cannot use team features)';
  end if;

  select * into target from teams where public_id = lower(trim(p_public_id));
  if target.id is null then raise exception 'team not found'; end if;
  select role into member_role from team_members where team_id = target.id and user_id = auth.uid();
  if member_role is null then
    if (select count(*) from team_members where user_id = auth.uid()) >= 3 then
      raise exception '已达到单账户最多 3 个团队的上限 (team count limit reached max 3)';
    end if;
    if target.invite_token_hash <> encode(digest(coalesce(p_invite_token, ''), 'sha256'), 'hex') then
      raise exception 'invalid invitation';
    end if;
    insert into team_members (team_id, user_id, role) values (target.id, auth.uid(), 'member');
    member_role := 'member';
  end if;
  return jsonb_build_object('id', target.id, 'public_id', target.public_id,
    'name', target.name, 'role', member_role);
end;
$$;

create or replace function public.get_team_members(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'team membership required';
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'joined_at', to_char(m.joined_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI'),
        'email', case 
          when u.email is null or u.email = '' then '匿名成员'
          else u.email
        end,
        'is_me', (m.user_id = auth.uid())
      ) order by m.joined_at asc
    ), '[]'::jsonb)
    from public.team_members m
    left join auth.users u on u.id = m.user_id
    where m.team_id = p_team_id
  );
end;
$$;

create or replace function public.get_my_teams()
returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'public_id', t.public_id,
        'name', t.name,
        'role', m.role,
        'joined_at', m.joined_at
      ) order by m.joined_at asc
    ), '[]'::jsonb)
    from teams t
    join team_members m on m.team_id = t.id
    where m.user_id = auth.uid()
  );
end;
$$;

create or replace function public.open_team(p_public_id text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target teams;
  member_role text;
begin
  select t.* into target from teams t join team_members m on m.team_id = t.id
  where t.public_id = lower(trim(p_public_id)) and m.user_id = auth.uid();
  if target.id is null then raise exception 'team membership required'; end if;
  select role into member_role from team_members where team_id = target.id and user_id = auth.uid();
  return jsonb_build_object('id', target.id, 'public_id', target.public_id,
    'name', target.name, 'role', member_role);
end;
$$;

create or replace function public.rotate_team_invite(p_team_id uuid)
returns text language plpgsql security definer set search_path = public, extensions
as $$
declare new_token text := encode(gen_random_bytes(18), 'hex');
begin
  if not public.can_manage_team(p_team_id) then raise exception 'manager permission required'; end if;
  update teams set invite_token_hash = encode(digest(new_token, 'sha256'), 'hex') where id = p_team_id;
  return new_token;
end;
$$;

create or replace function public.roll_team(p_team_id uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  picked team_locations;
  current_draw team_draws;
  total_weight numeric;
  target_weight numeric;
  business_day date := (now() at time zone 'Asia/Shanghai')::date;
  week_start date;
begin
  if not public.is_team_member(p_team_id) then raise exception 'team not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text || business_day::text, 0));
  select * into current_draw from team_draws where team_id = p_team_id and business_date = business_day;

  if current_draw.id is null or p_force then
    -- 本周起点：周一 (Asia/Shanghai 业务日期)
    week_start := business_day - ((extract(dow from business_day)::int + 6) % 7);
    if (select count(*) from team_locations where team_id = p_team_id and id not in (
      select location_id from team_draws where team_id = p_team_id and business_date >= week_start
    )) = 0 then
      -- 本周全选过，退回全量池，允许再次 Roll
      week_start := null;
    end if;

    select sum(weight) into total_weight
    from team_locations
    where team_id = p_team_id
      and (week_start is null or id not in (
        select location_id from team_draws where team_id = p_team_id and business_date >= week_start
      ));
    if coalesce(total_weight, 0) = 0 then raise exception 'team menu is empty'; end if;
    target_weight := random() * total_weight;
    select l.* into picked
    from team_locations l
    join (
      select id, sum(weight) over (order by created_at, id) as cumulative_weight
      from team_locations
      where team_id = p_team_id
        and (week_start is null or id not in (
          select location_id from team_draws where team_id = p_team_id and business_date >= week_start
        ))
    ) weighted on weighted.id = l.id
    where weighted.cumulative_weight >= target_weight
    order by weighted.cumulative_weight limit 1;

    insert into team_draws (team_id, location_id, business_date, drawn_by, drawn_at)
    values (p_team_id, picked.id, business_day, auth.uid(), now())
    on conflict (team_id, business_date) do update set location_id = excluded.location_id,
      drawn_by = excluded.drawn_by, drawn_at = excluded.drawn_at
    returning * into current_draw;
  else
    select * into picked from team_locations where id = current_draw.location_id;
  end if;

  return jsonb_build_object('date', current_draw.business_date, 'locationId', picked.id,
    'locationName', picked.name, 'emoji', picked.emoji, 'tags', to_jsonb(picked.tags),
    'priceRange', picked.price_range, 'recommendedDish', picked.recommended_dish,
    'rolledAt', to_char(current_draw.drawn_at at time zone 'Asia/Shanghai', 'HH24:MI'),
    'rolledBy', case when current_draw.drawn_by = auth.uid() then '我' else '团队成员' end);
end;
$$;

grant execute on function public.create_team(text, jsonb) to authenticated;
grant execute on function public.join_team(text, text) to authenticated;
grant execute on function public.open_team(text) to authenticated;
grant execute on function public.get_my_teams() to authenticated;
grant execute on function public.get_team_members(uuid) to authenticated;
grant execute on function public.rotate_team_invite(uuid) to authenticated;
grant execute on function public.roll_team(uuid, boolean) to authenticated;

revoke execute on function public.create_team(text, jsonb) from public, anon;
revoke execute on function public.join_team(text, text) from public, anon;
revoke execute on function public.open_team(text) from public, anon;
revoke execute on function public.get_my_teams() from public, anon;
revoke execute on function public.get_team_members(uuid) from public, anon;
revoke execute on function public.rotate_team_invite(uuid) from public, anon;
revoke execute on function public.roll_team(uuid, boolean) from public, anon;

alter publication supabase_realtime drop table public.team_locations;
alter publication supabase_realtime add table public.team_locations;
alter publication supabase_realtime drop table public.team_draws;
alter publication supabase_realtime add table public.team_draws;
