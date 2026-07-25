-- ============================================================================
-- Bixi app schema — extends the Sprout Supabase project.
-- ADDITIVE: does not touch the landing's existing waitlist / download_clicks.
-- Apply to your project (SQL Editor or `supabase db push`). Mirrors docs/PRD.md §20
-- + docs/DECISIONS.md. RLS on everything, membership-scoped.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar       text,
  timezone     text default 'UTC',
  push_token   text,
  active_hour  smallint,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pairs: the keeping unit (1 member = solo, 2 = paired). keeper_max lets us
-- grow to groups later (D1).
-- ---------------------------------------------------------------------------
create table if not exists public.pairs (
  id                uuid primary key default gen_random_uuid(),
  bixi_name         text not null default 'Bixi',
  relationship_kind text check (relationship_kind in ('couple','friends','family')),
  keeper_max        smallint not null default 2,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  hatched_at        timestamptz,   -- set on creation (alive from day one)
  bloomed_at        timestamptz    -- null until a co-parent joins
);

-- ---------------------------------------------------------------------------
-- membership (one row = solo, two = paired)
-- ---------------------------------------------------------------------------
create table if not exists public.pair_members (
  pair_id       uuid not null references public.pairs(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          text not null default 'keeper',
  joined_at     timestamptz not null default now(),
  last_daily_at timestamptz,   -- their last streak-qualifying (daily) interaction
  last_seen_at  timestamptz,   -- their last interaction of any kind
  primary key (pair_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- invites (opaque token + human code, single-use, expiring)
-- ---------------------------------------------------------------------------
create table if not exists public.invites (
  token      text primary key,
  code       text not null,
  pair_id    uuid not null references public.pairs(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- bixi live state (server-authoritative, one per pair)
-- ---------------------------------------------------------------------------
create table if not exists public.bixi_state (
  pair_id            uuid primary key references public.pairs(id) on delete cascade,
  mood               numeric not null default 25,     -- 0..100
  growth_stage       text not null default 'egg',
  streak             int not null default 0,          -- rolling, unforgiving
  best_streak        int not null default 0,
  total_care_days    int not null default 0,
  ever_reached_100   boolean not null default false,  -- "okay with only you" graduation
  dormant            boolean not null default false,
  revive_pending     uuid[] not null default '{}',
  has_companion      boolean not null default false,
  unlocked_secrets   text[] not null default '{}',
  mood_updated_at    timestamptz not null default now(),
  last_streak_day_at timestamptz,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- care events (audit + journal + streak source of truth)
-- ---------------------------------------------------------------------------
create table if not exists public.care_events (
  id               uuid primary key default gen_random_uuid(),
  pair_id          uuid not null references public.pairs(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  kind             text not null,                 -- interaction key or 'daily'
  is_daily         boolean not null default false,
  client_action_id text,                          -- idempotency
  note             text,
  stamp            text,
  created_at       timestamptz not null default now(),
  unique (profile_id, client_action_id)
);
create index if not exists care_events_pair_created_idx
  on public.care_events (pair_id, created_at desc);

-- ---------------------------------------------------------------------------
-- milestones / journal highlights
-- ---------------------------------------------------------------------------
create table if not exists public.milestones (
  id         uuid primary key default gen_random_uuid(),
  pair_id    uuid not null references public.pairs(id) on delete cascade,
  kind       text not null,   -- hatch|bloom|growth|revive|day7|day30|day100
  detail     text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- membership helper (security definer → avoids recursive RLS on pair_members)
-- ---------------------------------------------------------------------------
create or replace function public.is_pair_member(p uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pair_members m
    where m.pair_id = p and m.profile_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.pairs         enable row level security;
alter table public.pair_members  enable row level security;
alter table public.invites       enable row level security;
alter table public.bixi_state    enable row level security;
alter table public.care_events   enable row level security;
alter table public.milestones    enable row level security;

-- profiles: own row + profiles that share a pair with me
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_shared on public.profiles;
create policy profiles_shared on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.pair_members a
    join public.pair_members b on a.pair_id = b.pair_id
    where a.profile_id = auth.uid() and b.profile_id = public.profiles.id
  ));

-- pairs: members read/update; anyone authenticated may create (they become member via RPC)
drop policy if exists pairs_member on public.pairs;
create policy pairs_member on public.pairs
  for select to authenticated using (public.is_pair_member(id));
drop policy if exists pairs_update on public.pairs;
create policy pairs_update on public.pairs
  for update to authenticated using (public.is_pair_member(id));
drop policy if exists pairs_insert on public.pairs;
create policy pairs_insert on public.pairs
  for insert to authenticated with check (created_by = auth.uid());

-- pair_members: members read the roster; a user may insert their own membership
drop policy if exists members_read on public.pair_members;
create policy members_read on public.pair_members
  for select to authenticated using (public.is_pair_member(pair_id));
drop policy if exists members_self_insert on public.pair_members;
create policy members_self_insert on public.pair_members
  for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists members_self_update on public.pair_members;
create policy members_self_update on public.pair_members
  for update to authenticated using (profile_id = auth.uid());
drop policy if exists members_self_delete on public.pair_members;
create policy members_self_delete on public.pair_members
  for delete to authenticated using (profile_id = auth.uid());

-- invites: members manage their pair's invites (claim goes through an RPC)
drop policy if exists invites_member on public.invites;
create policy invites_member on public.invites
  for all to authenticated
  using (public.is_pair_member(pair_id))
  with check (public.is_pair_member(pair_id));

-- bixi_state: members read/update
drop policy if exists state_member on public.bixi_state;
create policy state_member on public.bixi_state
  for select to authenticated using (public.is_pair_member(pair_id));
drop policy if exists state_update on public.bixi_state;
create policy state_update on public.bixi_state
  for update to authenticated using (public.is_pair_member(pair_id));

-- care_events: members read; a user inserts their own care
drop policy if exists care_read on public.care_events;
create policy care_read on public.care_events
  for select to authenticated using (public.is_pair_member(pair_id));
drop policy if exists care_insert on public.care_events;
create policy care_insert on public.care_events
  for insert to authenticated
  with check (profile_id = auth.uid() and public.is_pair_member(pair_id));

-- milestones: members read (writes happen via SECURITY DEFINER functions)
drop policy if exists milestones_read on public.milestones;
create policy milestones_read on public.milestones
  for select to authenticated using (public.is_pair_member(pair_id));

-- ---------------------------------------------------------------------------
-- auto-provision: profile on signup, bixi_state on pair creation
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_pair()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.bixi_state (pair_id) values (new.id)
  on conflict (pair_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_pair_created on public.pairs;
create trigger on_pair_created
  after insert on public.pairs
  for each row execute function public.handle_new_pair();

-- when the last keeper leaves, remove the orphaned pair (state/events cascade)
create or replace function public.cleanup_empty_pair()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.pair_members where pair_id = old.pair_id) then
    delete from public.pairs where id = old.pair_id;
  end if;
  return old;
end; $$;
revoke execute on function public.cleanup_empty_pair() from anon, authenticated, public;

drop trigger if exists on_member_removed on public.pair_members;
create trigger on_member_removed
  after delete on public.pair_members
  for each row execute function public.cleanup_empty_pair();
