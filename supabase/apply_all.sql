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
-- ============================================================================
-- Bixi server-authoritative game logic (RPCs) — mirrors mobile/src/game/engine.ts
-- and the Area-12 numbers. All SECURITY INVOKER except where noted; RLS still applies.
-- ============================================================================

-- tuned constants as a single source (kept in sync with engine.ts)
create or replace function public._bixi_const()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'gain_daily', 2, 'gain_perm', 1,
    'budget_solo', 3, 'budget_paired', 2,
    'decay_solo', 5, 'decay_paired', 7,
    'penalty_sad', 10, 'penalty_dormant', 30,
    'sad_hours', 24, 'dormant_solo_h', 48, 'dormant_paired_h', 24,
    'window_h', 24, 'ceil_solo', 70, 'ceil_paired', 100,
    'secret_at', 80, 'dance_at', 90, 'graduation', 100
  );
$$;

create or replace function public._stage_for(streak int, paired boolean)
returns text language sql immutable as $$
  select case
    when streak >= 90 and paired then 'fullbloom'
    when streak >= 60 then 'bloom'
    when streak >= 30 then 'bud'
    when streak >= 7  then 'sprout'
    else 'egg' end;
$$;

create or replace function public._stage_idx(stage text)
returns int language sql immutable as $$
  select case stage when 'egg' then 0 when 'sprout' then 1 when 'bud' then 2
                    when 'bloom' then 3 when 'fullbloom' then 4 else 0 end;
$$;

-- ---------------------------------------------------------------------------
-- create_bixi: make a pair, join it, hatch. Returns pair_id.
-- ---------------------------------------------------------------------------
create or replace function public.create_bixi(p_name text, p_kind text, p_paired boolean)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_pair uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  -- v1: one Bixi per person
  if exists (select 1 from pair_members where profile_id = v_uid) then
    raise exception 'already_has_bixi';
  end if;
  insert into pairs (bixi_name, relationship_kind, created_by, hatched_at)
    values (coalesce(nullif(trim(p_name), ''), 'Bixi'),
            nullif(p_kind, ''), v_uid, now())
    returning id into v_pair;
  insert into pair_members (pair_id, profile_id, role, last_seen_at)
    values (v_pair, v_uid, 'keeper', now());
  insert into milestones (pair_id, kind, detail) values (v_pair, 'hatch', 'Day 001');
  return v_pair;
end; $$;

-- ---------------------------------------------------------------------------
-- create_invite: one active invite per pair. Returns { token, code, expires_at }.
-- ---------------------------------------------------------------------------
create or replace function public.create_invite(p_pair uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_token text; v_code text; v_exp timestamptz;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  delete from invites where pair_id = p_pair and claimed_by is null;
  v_token := encode(gen_random_bytes(16), 'hex');
  v_code  := 'BIXI-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
  v_exp   := now() + interval '7 days';
  insert into invites (token, code, pair_id, created_by, expires_at)
    values (v_token, v_code, p_pair, auth.uid(), v_exp);
  return jsonb_build_object('token', v_token, 'code', v_code, 'expires_at', v_exp);
end; $$;

-- ---------------------------------------------------------------------------
-- claim_invite: join the inviter's pair → bloom. SECURITY DEFINER (must read an
-- invite for a pair the caller isn't a member of yet). Returns pair_id.
-- ---------------------------------------------------------------------------
create or replace function public.claim_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv invites%rowtype; v_count int; v_max int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from pair_members where profile_id = v_uid) then
    raise exception 'already_has_bixi';
  end if;
  select * into v_inv from invites
    where token = p_token or upper(code) = upper(p_token)
    order by created_at desc limit 1;
  if not found then raise exception 'invalid_invite'; end if;
  if v_inv.claimed_by is not null then raise exception 'invite_used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite_expired'; end if;

  select count(*), max(p.keeper_max) into v_count, v_max
    from pair_members m join pairs p on p.id = m.pair_id
    where m.pair_id = v_inv.pair_id;
  if v_count >= v_max then raise exception 'pair_full'; end if;

  insert into pair_members (pair_id, profile_id, role, last_seen_at)
    values (v_inv.pair_id, v_uid, 'keeper', now());
  update invites set claimed_by = v_uid, claimed_at = now() where token = p_token;
  update pairs set bloomed_at = coalesce(bloomed_at, now()) where id = v_inv.pair_id;
  update bixi_state set mood = greatest(mood, 50), updated_at = now()
    where pair_id = v_inv.pair_id;
  insert into milestones (pair_id, kind, detail) values (v_inv.pair_id, 'bloom', 'co-parent joined');
  return v_inv.pair_id;
end; $$;

-- ---------------------------------------------------------------------------
-- apply_care: the authoritative care action. Idempotent on (profile, client_action_id).
-- Returns the updated bixi_state row.
-- ---------------------------------------------------------------------------
create or replace function public.apply_care(
  p_pair uuid, p_kind text, p_is_daily boolean, p_client_action_id text, p_note text
) returns bixi_state language plpgsql security invoker set search_path = public as $$
declare
  k jsonb := _bixi_const();
  v_uid uuid := auth.uid();
  v_members int; v_paired boolean; v_ceiling numeric; v_budget numeric;
  v_gain numeric; v_spent numeric; v_actual numeric;
  v_old_seen timestamptz; v_inserted boolean := true;
  st bixi_state%rowtype; v_all_current boolean; v_new_cycle boolean;
  v_newmood numeric; v_stage text; v_streak int := 0;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;

  -- idempotency
  begin
    insert into care_events (pair_id, profile_id, kind, is_daily, client_action_id, note)
      values (p_pair, v_uid, p_kind, coalesce(p_is_daily,false), p_client_action_id, nullif(p_note,''));
  exception when unique_violation then
    v_inserted := false;
  end;

  select last_seen_at into v_old_seen from pair_members
    where pair_id = p_pair and profile_id = v_uid;

  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;

  update pair_members set last_seen_at = now(),
    last_daily_at = case when p_is_daily then now() else last_daily_at end
    where pair_id = p_pair and profile_id = v_uid;

  select * into st from bixi_state where pair_id = p_pair for update;
  v_ceiling := case when v_paired or st.ever_reached_100 then (k->>'ceil_paired')::numeric else (k->>'ceil_solo')::numeric end;

  if not v_inserted then return st; end if;  -- duplicate action → no double gain

  v_gain   := case when p_is_daily then (k->>'gain_daily')::numeric else (k->>'gain_perm')::numeric end;
  v_budget := case when v_paired then (k->>'budget_paired')::numeric else (k->>'budget_solo')::numeric end;

  -- mood already gained this cycle by this keeper (last 24h), excluding current
  select coalesce(sum(case when is_daily then (k->>'gain_daily')::numeric else (k->>'gain_perm')::numeric end),0)
    into v_spent from care_events
    where pair_id = p_pair and profile_id = v_uid
      and created_at > now() - interval '24 hours';
  v_spent  := greatest(0, v_spent - v_gain);
  v_actual := greatest(0, least(v_gain, v_budget - v_spent));

  v_newmood := st.mood;
  -- sad recovery: paired keeper returning after > sad_hours costs a one-time penalty
  if v_paired and v_old_seen is not null
     and now() - v_old_seen > make_interval(hours => (k->>'sad_hours')::int) then
    v_newmood := greatest(0, v_newmood - (k->>'penalty_sad')::numeric);
  end if;
  v_newmood := least(v_ceiling, greatest(0, v_newmood + v_actual));

  v_streak := st.streak;
  if p_is_daily then
    select bool_and(last_daily_at is not null and now() - last_daily_at < interval '24 hours')
      into v_all_current from pair_members where pair_id = p_pair;
    v_new_cycle := st.last_streak_day_at is null
                   or now() - st.last_streak_day_at > interval '20 hours';
    if (not v_paired or v_all_current) and v_new_cycle then
      v_streak := st.streak + 1;
      update bixi_state set
        streak = v_streak,
        best_streak = greatest(best_streak, v_streak),
        total_care_days = total_care_days + 1,
        last_streak_day_at = now()
      where pair_id = p_pair;
    end if;
  end if;

  -- growth (permanent, unbroken-streak gated)
  v_stage := _stage_for(v_streak, v_paired);
  if _stage_idx(v_stage) > _stage_idx(st.growth_stage) then
    update bixi_state set growth_stage = v_stage,
      has_companion = has_companion or v_stage = 'fullbloom',
      unlocked_secrets = case when v_stage = 'fullbloom'
        then (select array(select distinct unnest(unlocked_secrets || array['companion'])))
        else unlocked_secrets end
      where pair_id = p_pair;
    insert into milestones (pair_id, kind, detail) values (p_pair, 'growth', v_stage);
  end if;
  if v_streak >= (k->>'graduation')::int and v_paired then
    update bixi_state set ever_reached_100 = true where pair_id = p_pair;
  end if;

  update bixi_state set
    mood = v_newmood,
    mood_updated_at = now(),
    updated_at = now(),
    unlocked_secrets = (select array(select distinct unnest(
        unlocked_secrets
        || case when v_newmood >= (k->>'secret_at')::numeric then array['secret1'] else array[]::text[] end
        || case when v_newmood >= (k->>'dance_at')::numeric then array['dance'] else array[]::text[] end)))
    where pair_id = p_pair;

  select * into st from bixi_state where pair_id = p_pair;
  return st;
end; $$;

-- ---------------------------------------------------------------------------
-- revive: caller pets a dormant Bixi. Both-drifted needs all keepers. -30 on complete.
-- ---------------------------------------------------------------------------
create or replace function public.revive(p_pair uuid)
returns bixi_state language plpgsql security invoker set search_path = public as $$
declare k jsonb := _bixi_const(); v_uid uuid := auth.uid(); st bixi_state%rowtype;
        v_pending uuid[]; v_ceiling numeric; v_paired boolean; v_members int;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  select * into st from bixi_state where pair_id = p_pair for update;
  if not st.dormant then return st; end if;
  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;

  update pair_members set last_seen_at = now() where pair_id = p_pair and profile_id = v_uid;
  v_pending := array_remove(st.revive_pending, v_uid);

  if v_paired and array_length(v_pending, 1) > 0 then
    update bixi_state set revive_pending = v_pending where pair_id = p_pair;
    select * into st from bixi_state where pair_id = p_pair; return st;
  end if;

  v_ceiling := case when v_paired or st.ever_reached_100 then 100 else 70 end;
  update bixi_state set dormant = false, revive_pending = '{}',
    mood = least(v_ceiling, greatest(0, st.mood - (k->>'penalty_dormant')::numeric)),
    mood_updated_at = now(), updated_at = now()
    where pair_id = p_pair;
  insert into milestones (pair_id, kind, detail) values (p_pair, 'revive', null);
  select * into st from bixi_state where pair_id = p_pair; return st;
end; $$;

-- ---------------------------------------------------------------------------
-- leave_pair: caller leaves → reverts to solo for whoever remains.
-- ---------------------------------------------------------------------------
create or replace function public.leave_pair(p_pair uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  delete from pair_members where pair_id = p_pair and profile_id = auth.uid();
  update pairs set bloomed_at = null where id = p_pair
    and (select count(*) from pair_members where pair_id = p_pair) < 2;
end; $$;

-- ---------------------------------------------------------------------------
-- recompute_pair / recompute_all: decay + dormant + streak-break for cron.
-- SECURITY DEFINER so pg_cron (no auth.uid()) can run it across all pairs.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_pair(p_pair uuid)
returns void language plpgsql security definer set search_path = public as $$
declare k jsonb := _bixi_const(); st bixi_state%rowtype;
        v_members int; v_paired boolean; v_last_seen timestamptz;
        v_neglect_h numeric; v_drift_all boolean; v_ceiling numeric;
        v_decay numeric; v_days numeric;
begin
  select * into st from bixi_state where pair_id = p_pair for update;
  if st.pair_id is null then return; end if;
  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;
  v_ceiling := case when v_paired or st.ever_reached_100 then 100 else 70 end;

  select max(last_seen_at) into v_last_seen from pair_members where pair_id = p_pair;
  v_last_seen := coalesce(v_last_seen, (select hatched_at from pairs where id = p_pair));
  if v_last_seen is null then return; end if;
  v_neglect_h := extract(epoch from (now() - v_last_seen)) / 3600.0;

  -- decay (only after the first neglected cycle)
  if v_neglect_h > (k->>'window_h')::numeric then
    v_days := (v_neglect_h - (k->>'window_h')::numeric) / 24.0;
    v_decay := case when v_paired then (k->>'decay_paired')::numeric else (k->>'decay_solo')::numeric end;
    update bixi_state set mood = greatest(0, st.mood - v_decay * v_days),
      mood_updated_at = now(), updated_at = now() where pair_id = p_pair;
  end if;

  -- dormant
  select bool_and(last_seen_at is null
    or now() - last_seen_at > make_interval(hours => (k->>'sad_hours')::int))
    into v_drift_all from pair_members where pair_id = p_pair;
  if not st.dormant and (
       (not v_paired and v_neglect_h > (k->>'dormant_solo_h')::numeric)
    or (v_paired and v_drift_all and v_neglect_h > (k->>'dormant_paired_h')::numeric)
  ) then
    update bixi_state set dormant = true,
      revive_pending = case when v_paired
        then (select array_agg(profile_id) from pair_members where pair_id = p_pair)
        else '{}' end
      where pair_id = p_pair;
  end if;

  -- unforgiving streak break
  if st.streak > 0 and v_neglect_h > (k->>'window_h')::numeric then
    update bixi_state set streak = 0 where pair_id = p_pair;
  end if;
end; $$;

create or replace function public.recompute_all()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select pair_id from bixi_state loop
    perform recompute_pair(r.pair_id);
  end loop;
end; $$;

grant execute on function public.create_bixi(text, text, boolean) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.apply_care(uuid, text, boolean, text, text) to authenticated;
grant execute on function public.revive(uuid) to authenticated;
grant execute on function public.leave_pair(uuid) to authenticated;
-- ============================================================================
-- Security hardening for the Bixi functions (from Supabase advisor).
-- ============================================================================

-- pin search_path on the immutable helpers
alter function public._bixi_const()             set search_path = public;
alter function public._stage_for(int, boolean)  set search_path = public;
alter function public._stage_idx(text)          set search_path = public;

-- trigger-only functions must not be callable over the REST API
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_new_pair() from anon, authenticated, public;

-- cron-only compute functions must not be callable by clients
revoke execute on function public.recompute_all()          from anon, authenticated, public;
revoke execute on function public.recompute_pair(uuid)     from anon, authenticated, public;

-- membership helper: RLS (authenticated) needs it, but anon never should
revoke execute on function public.is_pair_member(uuid) from anon, public;

-- joining is for signed-in users only
revoke execute on function public.claim_invite(text) from anon, public;
-- ============================================================================
-- Notification targeting (Area 6). Service-role only; called by the `notify`
-- Edge Function on a schedule. Returns keepers whose streak is at risk:
-- their last daily was 20–24h ago (the "Bixi misses you" window).
-- ============================================================================

create or replace function public.nudge_targets()
returns table(profile_id uuid, push_token text, bixi_name text, streak int)
language sql
security definer
stable
set search_path = public
as $$
  select m.profile_id, pr.push_token, p.bixi_name, s.streak
  from public.pair_members m
  join public.profiles pr on pr.id = m.profile_id
  join public.pairs p     on p.id = m.pair_id
  join public.bixi_state s on s.pair_id = m.pair_id
  where pr.push_token is not null
    and m.last_daily_at is not null
    and now() - m.last_daily_at between interval '20 hours' and interval '24 hours'
    and not s.dormant;
$$;

revoke execute on function public.nudge_targets() from anon, authenticated, public;
