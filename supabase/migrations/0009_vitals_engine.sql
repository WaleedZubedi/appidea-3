-- ============================================================================
-- 0009 — VITALS ENGINE (applied live 2026-07-20)
--
-- Product pivot (owner decision): Bixi's home is now backed by REAL vitals.
--   • Feed & Water  : consumable meters (0–100) on bixi_state. Refill on tap,
--                     drain continuously. You watch them drop.
--   • Bond          : PER-KEEPER (0–100) on pair_members. Grows from that
--                     keeper's own daily + pets; decays when they drift.
--   • Wellbeing     : DERIVED headline (the "Thriving" word + Bixi's face),
--                     stored in bixi_state.mood = 0.30·feed + 0.30·water +
--                     0.40·avg(bond), clamped to the ceiling (70 solo / 100
--                     paired-or-graduated). Consistency (streak) gates the
--                     radiant "Thriving" top state on the client.
--   • Sad           : paired, one keeper absent ≥24h (unchanged).
--   • Dormant       : STARVED (feed<15 AND water<15) + neglect — solo >48h,
--                     paired when a keeper is also absent. Revive → he comes
--                     back starving (feed=water=25).
--
-- KEPT INTACT: streak, growth ladder, graduation, invite/claim/bloom, leave
-- flow, realtime. Everything below is SECURITY DEFINER with in-function guards
-- (RLS remains the read model), matching 0008.
-- ============================================================================

-- ---------- columns ----------
alter table public.bixi_state   add column if not exists feed  numeric not null default 60;
alter table public.bixi_state   add column if not exists water numeric not null default 60;
alter table public.bixi_state   add column if not exists vitals_updated_at timestamptz not null default now();
alter table public.pair_members add column if not exists bond  numeric not null default 20;
alter table public.pair_members add column if not exists last_feed_at  timestamptz;
alter table public.pair_members add column if not exists last_water_at timestamptz;
alter table public.pair_members add column if not exists last_pet_at   timestamptz;

-- ---------- constants (extends the v1 tuning) ----------
create or replace function public._bixi_const()
 returns jsonb language sql immutable set search_path to 'public'
as $$
  select jsonb_build_object(
    -- streak / growth (kept)
    'gain_daily', 2, 'gain_perm', 1,
    'sad_hours', 24, 'dormant_solo_h', 48, 'dormant_paired_h', 24,
    'window_h', 24, 'ceil_solo', 70, 'ceil_paired', 100,
    'secret_at', 80, 'dance_at', 90, 'graduation', 100,
    -- vitals (new)
    'feed_refill', 45, 'water_refill', 45,
    'feed_decay', 40, 'water_decay', 45,          -- per day
    'vital_cooldown_h', 8, 'pet_cooldown_h', 4,
    'bond_daily', 8, 'bond_pet', 3, 'bond_decay', 3, 'bond_absence_penalty', 10,
    'bond_max', 100, 'both_here_bump', 5,
    'w_feed', 0.30, 'w_water', 0.30, 'w_bond', 0.40,
    'starved_at', 15, 'revive_vital', 25,
    'hatch_vital', 60, 'bloom_vital', 70, 'bond_start', 20
  );
$$;

-- ---------- derived wellbeing (writes bixi_state.mood + reward unlocks) ----------
create or replace function public._recompute_wellbeing(p_pair uuid)
 returns numeric language plpgsql security definer set search_path to 'public'
as $$
declare k jsonb := _bixi_const(); st bixi_state%rowtype;
        v_members int; v_ceiling numeric; v_avgbond numeric; v_w numeric;
begin
  select * into st from bixi_state where pair_id = p_pair for update;
  if st.pair_id is null then return null; end if;
  select count(*), coalesce(avg(bond),0) into v_members, v_avgbond
    from pair_members where pair_id = p_pair;
  v_ceiling := case when v_members >= 2 or st.ever_reached_100
                    then (k->>'ceil_paired')::numeric else (k->>'ceil_solo')::numeric end;
  v_w := round( (k->>'w_feed')::numeric  * st.feed
              + (k->>'w_water')::numeric * st.water
              + (k->>'w_bond')::numeric  * v_avgbond );
  v_w := greatest(0, least(v_ceiling, v_w));
  update bixi_state set
    mood = v_w,
    mood_updated_at = now(), updated_at = now(),
    unlocked_secrets = (select array(select distinct unnest(
        unlocked_secrets
        || case when v_w >= (k->>'secret_at')::numeric then array['secret1'] else array[]::text[] end
        || case when v_w >= (k->>'dance_at')::numeric  then array['dance']   else array[]::text[] end)))
    where pair_id = p_pair;
  return v_w;
end; $$;

-- ---------- apply_care: routes feed / water / pet / daily to vitals + bond ----------
create or replace function public.apply_care(p_pair uuid, p_kind text, p_is_daily boolean, p_client_action_id text, p_note text)
 returns bixi_state language plpgsql security definer set search_path to 'public'
as $$
declare
  k jsonb := _bixi_const(); v_uid uuid := auth.uid();
  v_members int; v_paired boolean; v_inserted boolean := true;
  st bixi_state%rowtype; v_old_seen timestamptz;
  v_all_current boolean; v_new_cycle boolean; v_streak int; v_stage text;
  v_last_feed timestamptz; v_last_water timestamptz; v_last_pet timestamptz;
  v_cool interval := make_interval(hours => (k->>'vital_cooldown_h')::int);
  v_petcool interval := make_interval(hours => (k->>'pet_cooldown_h')::int);
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;

  begin
    insert into care_events (pair_id, profile_id, kind, is_daily, client_action_id, note)
      values (p_pair, v_uid, p_kind, coalesce(p_is_daily,false), p_client_action_id, nullif(p_note,''));
  exception when unique_violation then v_inserted := false;
  end;

  select last_seen_at, last_feed_at, last_water_at, last_pet_at, bond
    into v_old_seen, v_last_feed, v_last_water, v_last_pet, v_streak  -- v_streak reused as scratch below; refetched
    from pair_members where pair_id = p_pair and profile_id = v_uid;

  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;

  update pair_members set last_seen_at = now(),
    last_daily_at = case when p_is_daily then now() else last_daily_at end
    where pair_id = p_pair and profile_id = v_uid;

  select * into st from bixi_state where pair_id = p_pair for update;
  if not v_inserted then return st; end if;   -- duplicate action → no effect

  -- returning after a long absence dents this keeper's bond (paired "sad")
  if v_paired and v_old_seen is not null
     and now() - v_old_seen > make_interval(hours => (k->>'sad_hours')::int) then
    update pair_members set bond = greatest(0, bond - (k->>'bond_absence_penalty')::numeric)
      where pair_id = p_pair and profile_id = v_uid;
  end if;

  if p_is_daily then
    -- daily: build this keeper's bond + advance the (both-current) streak
    update pair_members set bond = least((k->>'bond_max')::numeric, bond + (k->>'bond_daily')::numeric)
      where pair_id = p_pair and profile_id = v_uid;
    v_streak := st.streak;
    select bool_and(last_daily_at is not null and now() - last_daily_at < interval '24 hours')
      into v_all_current from pair_members where pair_id = p_pair;
    v_new_cycle := st.last_streak_day_at is null or now() - st.last_streak_day_at > interval '20 hours';
    if (not v_paired or v_all_current) and v_new_cycle then
      v_streak := st.streak + 1;
      update bixi_state set streak = v_streak, best_streak = greatest(best_streak, v_streak),
        total_care_days = total_care_days + 1, last_streak_day_at = now()
        where pair_id = p_pair;
    end if;
  elsif p_kind = 'feed' then
    if v_last_feed is null or now() - v_last_feed > v_cool then
      update bixi_state set feed = least(100, feed + (k->>'feed_refill')::numeric) where pair_id = p_pair;
      update pair_members set last_feed_at = now() where pair_id = p_pair and profile_id = v_uid;
    end if;
  elsif p_kind = 'water' then
    if v_last_water is null or now() - v_last_water > v_cool then
      update bixi_state set water = least(100, water + (k->>'water_refill')::numeric) where pair_id = p_pair;
      update pair_members set last_water_at = now() where pair_id = p_pair and profile_id = v_uid;
    end if;
  else
    -- pet / tickle / etc → build bond (light, cooldown-limited)
    if v_last_pet is null or now() - v_last_pet > v_petcool then
      update pair_members set bond = least((k->>'bond_max')::numeric, bond + (k->>'bond_pet')::numeric),
        last_pet_at = now() where pair_id = p_pair and profile_id = v_uid;
    end if;
  end if;

  -- growth (streak-gated, permanent) — recompute against the current streak
  select streak into v_streak from bixi_state where pair_id = p_pair;
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

  perform _recompute_wellbeing(p_pair);
  select * into st from bixi_state where pair_id = p_pair;
  return st;
end; $$;

-- ---------- recompute_pair: vitals + bond decay, wellbeing, starvation dormancy ----------
create or replace function public.recompute_pair(p_pair uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare k jsonb := _bixi_const(); st bixi_state%rowtype;
        v_members int; v_paired boolean; v_hours numeric; v_neglect_h numeric;
        v_last_seen timestamptz; v_starved boolean; v_some_absent boolean;
        v_daily_lapsed boolean;
begin
  if auth.uid() is not null and not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  select * into st from bixi_state where pair_id = p_pair for update;
  if st.pair_id is null then return; end if;
  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;

  -- vitals + bond drain (idempotent: keyed to vitals_updated_at)
  v_hours := extract(epoch from (now() - st.vitals_updated_at)) / 3600.0;
  if v_hours > 0 then
    update bixi_state set
      feed  = greatest(0, feed  - (k->>'feed_decay')::numeric  * v_hours / 24.0),
      water = greatest(0, water - (k->>'water_decay')::numeric * v_hours / 24.0),
      vitals_updated_at = now()
      where pair_id = p_pair;
    update pair_members set bond = greatest(0, bond - (k->>'bond_decay')::numeric * v_hours / 24.0)
      where pair_id = p_pair and now() - coalesce(last_seen_at, joined_at) > interval '24 hours';
  end if;

  perform _recompute_wellbeing(p_pair);
  select * into st from bixi_state where pair_id = p_pair;

  -- dormancy: STARVED + neglect (solo >48h) or STARVED + a keeper absent (paired)
  select max(last_seen_at) into v_last_seen from pair_members where pair_id = p_pair;
  v_last_seen := coalesce(v_last_seen, (select hatched_at from pairs where id = p_pair));
  v_neglect_h := extract(epoch from (now() - coalesce(v_last_seen, now()))) / 3600.0;
  v_starved := st.feed < (k->>'starved_at')::numeric and st.water < (k->>'starved_at')::numeric;
  select bool_or(last_seen_at is null or now() - last_seen_at > make_interval(hours => (k->>'sad_hours')::int))
    into v_some_absent from pair_members where pair_id = p_pair;

  if not st.dormant and v_starved and (
       (not v_paired and v_neglect_h > (k->>'dormant_solo_h')::numeric)
    or (v_paired and v_some_absent)
  ) then
    update bixi_state set dormant = true, updated_at = now(),
      revive_pending = case when v_paired
        then (select array_agg(profile_id) from pair_members where pair_id = p_pair) else '{}' end
      where pair_id = p_pair;
  end if;

  -- unforgiving streak (per-keeper daily clock)
  if st.streak > 0 then
    select bool_or(now() - coalesce(last_daily_at, joined_at) > interval '24 hours')
      into v_daily_lapsed from pair_members where pair_id = p_pair;
    if v_daily_lapsed then update bixi_state set streak = 0, updated_at = now() where pair_id = p_pair; end if;
  end if;
end; $$;

-- ---------- revive: comes back starving ----------
create or replace function public.revive(p_pair uuid)
 returns bixi_state language plpgsql security definer set search_path to 'public'
as $$
declare k jsonb := _bixi_const(); v_uid uuid := auth.uid(); st bixi_state%rowtype;
        v_pending uuid[]; v_paired boolean; v_members int;
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

  update bixi_state set dormant = false, revive_pending = '{}',
    feed = greatest(feed, (k->>'revive_vital')::numeric),
    water = greatest(water, (k->>'revive_vital')::numeric),
    vitals_updated_at = now(), updated_at = now()
    where pair_id = p_pair;
  insert into milestones (pair_id, kind, detail) values (p_pair, 'revive', null);
  perform _recompute_wellbeing(p_pair);
  select * into st from bixi_state where pair_id = p_pair; return st;
end; $$;

-- ---------- both_here: shared boost to both vitals, once/20h ----------
create or replace function public.both_here(p_pair uuid)
 returns bixi_state language plpgsql set search_path to 'public'
as $$
declare k jsonb := _bixi_const(); st bixi_state%rowtype; v_members int;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  select * into st from bixi_state where pair_id = p_pair for update;
  select count(*) into v_members from pair_members where pair_id = p_pair;
  if v_members < 2 or st.dormant then return st; end if;
  if st.last_both_here_at is not null and now() - st.last_both_here_at < interval '20 hours' then
    return st;
  end if;
  update bixi_state set
    feed  = least(100, feed  + (k->>'both_here_bump')::numeric),
    water = least(100, water + (k->>'both_here_bump')::numeric),
    last_both_here_at = now(), vitals_updated_at = vitals_updated_at
    where pair_id = p_pair;
  perform _recompute_wellbeing(p_pair);
  select * into st from bixi_state where pair_id = p_pair; return st;
end; $$;

-- ---------- create_bixi: seed wellbeing at hatch ----------
create or replace function public.create_bixi(p_name text, p_kind text, p_paired boolean)
 returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare v_pair uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from pair_members where profile_id = v_uid) then raise exception 'already_has_bixi'; end if;
  insert into pairs (bixi_name, relationship_kind, created_by, hatched_at)
    values (coalesce(nullif(trim(p_name), ''), 'Bixi'), nullif(p_kind, ''), v_uid, now())
    returning id into v_pair;
  insert into pair_members (pair_id, profile_id, role, last_seen_at)
    values (v_pair, v_uid, 'keeper', now());
  insert into milestones (pair_id, kind, detail) values (v_pair, 'hatch', 'Day 001');
  perform _recompute_wellbeing(v_pair);
  return v_pair;
end; $$;

-- ---------- claim_invite: bloom bumps vitals (joiner bond via column default) ----------
create or replace function public.claim_invite(p_token text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare k jsonb := _bixi_const(); v_uid uuid := auth.uid(); v_inv invites%rowtype;
        v_count int; v_max int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from pair_members where profile_id = v_uid) then raise exception 'already_has_bixi'; end if;
  select * into v_inv from invites where token = p_token or upper(code) = upper(p_token)
    order by created_at desc limit 1;
  if not found then raise exception 'invalid_invite'; end if;
  if v_inv.claimed_by is not null then raise exception 'invite_used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite_expired'; end if;
  select count(*), max(p.keeper_max) into v_count, v_max
    from pair_members m join pairs p on p.id = m.pair_id where m.pair_id = v_inv.pair_id;
  if v_count >= v_max then raise exception 'pair_full'; end if;

  insert into pair_members (pair_id, profile_id, role, last_seen_at)
    values (v_inv.pair_id, v_uid, 'keeper', now());
  update invites set claimed_by = v_uid, claimed_at = now()
    where token = v_inv.token and claimed_by is null;
  update pairs set bloomed_at = coalesce(bloomed_at, now()) where id = v_inv.pair_id;
  update bixi_state set
    feed  = greatest(feed,  (k->>'bloom_vital')::numeric),
    water = greatest(water, (k->>'bloom_vital')::numeric),
    vitals_updated_at = now()
    where pair_id = v_inv.pair_id;
  insert into milestones (pair_id, kind, detail) values (v_inv.pair_id, 'bloom', 'co-parent joined');
  perform _recompute_wellbeing(v_inv.pair_id);
  return v_inv.pair_id;
end; $$;

-- ---------- grants ----------
revoke all on function public._recompute_wellbeing(uuid) from public, anon, authenticated;
revoke all on function public.apply_care(uuid, text, boolean, text, text) from public, anon;
revoke all on function public.recompute_pair(uuid) from public, anon;
revoke all on function public.revive(uuid) from public, anon;
revoke all on function public.both_here(uuid) from public, anon;
revoke all on function public.create_bixi(text, text, boolean) from public, anon;
revoke all on function public.claim_invite(text) from public, anon;
grant execute on function public.apply_care(uuid, text, boolean, text, text) to authenticated;
grant execute on function public.recompute_pair(uuid) to authenticated;
grant execute on function public.revive(uuid) to authenticated;
grant execute on function public.both_here(uuid) to authenticated;
grant execute on function public.create_bixi(text, text, boolean) to authenticated;
grant execute on function public.claim_invite(text) to authenticated;
