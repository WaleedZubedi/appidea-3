-- ============================================================================
-- 0015: Shared bond (synced across both keepers) + dev_set_state admin RPC.
--
-- APPLIED TO LIVE DB (project mvyktmxkhwigrrftsbpn) on 2026-07-21 via MCP as
-- migration `shared_bond_and_dev_set_state_0015`. Recorded here for the repo.
-- NOTE: the live DB also has 0010–0014 that were applied directly and are not
-- yet mirrored in this folder.
--
-- Bond stays in pair_members (per-keeper cooldowns kept) but every bond WRITE
-- now targets ALL members, so both parents always hold the same value and
-- avg(bond) — the mood input — is unchanged. Feed/water/streak/growth are
-- already pair-level. dev_set_state lets the (member-only) admin panel patch
-- shared state on the server so realtime propagates it to both parents.
-- ============================================================================

-- one-time: converge existing per-keeper bond to the pair's best value
update pair_members m set bond = sub.mx
from (select pair_id, max(bond) as mx from pair_members group by pair_id) sub
where m.pair_id = sub.pair_id and m.bond is distinct from sub.mx;

-- ---------- apply_care: bond gains/penalties now apply to the WHOLE pair ----------
create or replace function public.apply_care(p_pair uuid, p_kind text, p_is_daily boolean, p_client_action_id text, p_note text)
 returns bixi_state
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  k jsonb := _bixi_const(); v_uid uuid := auth.uid();
  v_members int; v_paired boolean; v_inserted boolean := true;
  st bixi_state%rowtype; v_old_seen timestamptz; v_scratch numeric;
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
    into v_old_seen, v_last_feed, v_last_water, v_last_pet, v_scratch
    from pair_members where pair_id = p_pair and profile_id = v_uid;

  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;

  update pair_members set last_seen_at = now(),
    last_daily_at = case when p_is_daily then now() else last_daily_at end
    where pair_id = p_pair and profile_id = v_uid;

  select * into st from bixi_state where pair_id = p_pair for update;
  if not v_inserted then return st; end if;

  -- absence penalty → SHARED bond (whole pair)
  if v_paired and v_old_seen is not null
     and now() - v_old_seen > make_interval(hours => (k->>'sad_hours')::int) then
    update pair_members set bond = greatest(0, bond - (k->>'bond_absence_penalty')::numeric)
      where pair_id = p_pair;
  end if;

  if p_is_daily then
    -- daily bond → SHARED bond (whole pair)
    update pair_members set bond = least((k->>'bond_max')::numeric, bond + (k->>'bond_daily')::numeric)
      where pair_id = p_pair;
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
    -- pet / shower / tickle / etc → SHARED bond; cooldown stays per-keeper
    if v_last_pet is null or now() - v_last_pet > v_petcool then
      update pair_members set bond = least((k->>'bond_max')::numeric, bond + (k->>'bond_pet')::numeric)
        where pair_id = p_pair;
      update pair_members set last_pet_at = now()
        where pair_id = p_pair and profile_id = v_uid;
    end if;
  end if;

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
end; $function$;

-- ---------- recompute_pair: bond decay now pair-wide (keeps both keepers equal) ----------
create or replace function public.recompute_pair(p_pair uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare k jsonb := _bixi_const(); st bixi_state%rowtype;
        v_members int; v_paired boolean; v_hours numeric; v_neglect_h numeric;
        v_last_seen timestamptz; v_starved boolean; v_some_absent boolean; v_daily_lapsed boolean;
        v_pair_seen timestamptz;
begin
  if auth.uid() is not null and not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  select * into st from bixi_state where pair_id = p_pair for update;
  if st.pair_id is null then return; end if;
  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;

  v_hours := extract(epoch from (now() - st.vitals_updated_at)) / 3600.0;
  if v_hours > 0 then
    update bixi_state set
      feed  = greatest(0, feed  - (k->>'feed_decay')::numeric  * v_hours / 24.0),
      water = greatest(0, water - (k->>'water_decay')::numeric * v_hours / 24.0),
      vitals_updated_at = now()
      where pair_id = p_pair;
    -- shared bond: decays for the WHOLE pair only when the pair as a whole
    -- (its most-recent keeper visit) has been neglected > 24h — keeps both equal
    select max(last_seen_at) into v_pair_seen from pair_members where pair_id = p_pair;
    v_pair_seen := coalesce(v_pair_seen, (select hatched_at from pairs where id = p_pair));
    if v_pair_seen is not null and now() - v_pair_seen > interval '24 hours' then
      update pair_members set bond = greatest(0, bond - (k->>'bond_decay')::numeric * v_hours / 24.0)
        where pair_id = p_pair;
    end if;
  end if;

  perform _recompute_wellbeing(p_pair);
  select * into st from bixi_state where pair_id = p_pair;

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

  if st.streak > 0 then
    select bool_or(now() - coalesce(last_daily_at, joined_at) > interval '24 hours')
      into v_daily_lapsed from pair_members where pair_id = p_pair;
    if v_daily_lapsed then update bixi_state set streak = 0, updated_at = now() where pair_id = p_pair; end if;
  end if;
end; $function$;

-- ---------- dev_set_state: member-scoped admin patch (drives realtime → both parents) ----------
create or replace function public.dev_set_state(
  p_pair uuid,
  p_feed numeric default null,
  p_water numeric default null,
  p_bond numeric default null,
  p_streak integer default null,
  p_growth text default null,
  p_dormant boolean default null,
  p_daily text default null,            -- 'done' | 'undone'
  p_clear_cooldowns boolean default null,
  p_advance_ms bigint default null
)
 returns bixi_state
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare st bixi_state%rowtype; v_iv interval;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;

  if p_feed is not null then
    update bixi_state set feed = greatest(0, least(100, p_feed)), vitals_updated_at = now(), updated_at = now()
      where pair_id = p_pair;
  end if;
  if p_water is not null then
    update bixi_state set water = greatest(0, least(100, p_water)), vitals_updated_at = now(), updated_at = now()
      where pair_id = p_pair;
  end if;
  if p_bond is not null then
    update pair_members set bond = greatest(0, least(100, p_bond)) where pair_id = p_pair;
  end if;
  if p_streak is not null then
    update bixi_state set streak = greatest(0, p_streak),
      best_streak = greatest(best_streak, greatest(0, p_streak)),
      last_streak_day_at = now(), updated_at = now()
      where pair_id = p_pair;
    update pair_members set last_daily_at = now(), last_seen_at = now() where pair_id = p_pair;
  end if;
  if p_growth is not null then
    update bixi_state set growth_stage = p_growth,
      has_companion = has_companion or p_growth = 'fullbloom', updated_at = now()
      where pair_id = p_pair;
  end if;
  if p_dormant is not null then
    if p_dormant then
      update bixi_state set dormant = true, updated_at = now() where pair_id = p_pair;
    else
      update bixi_state set dormant = false, revive_pending = '{}', vitals_updated_at = now(), updated_at = now()
        where pair_id = p_pair;
      update pair_members set last_seen_at = now() where pair_id = p_pair;
    end if;
  end if;
  if p_daily = 'done' then
    update pair_members set last_daily_at = now(), last_seen_at = now() where pair_id = p_pair;
  elsif p_daily = 'undone' then
    update pair_members set last_daily_at = null where pair_id = p_pair;
  end if;
  if p_clear_cooldowns then
    update pair_members set last_feed_at = null, last_water_at = null, last_pet_at = null where pair_id = p_pair;
  end if;

  if p_advance_ms is not null and p_advance_ms <> 0 then
    v_iv := make_interval(secs => p_advance_ms / 1000.0);
    update bixi_state set
      vitals_updated_at  = vitals_updated_at  - v_iv,
      mood_updated_at    = mood_updated_at    - v_iv,
      last_streak_day_at = last_streak_day_at - v_iv,
      last_both_here_at  = last_both_here_at  - v_iv,
      updated_at = now()
      where pair_id = p_pair;
    update pairs set hatched_at = hatched_at - v_iv, bloomed_at = bloomed_at - v_iv where id = p_pair;
    update pair_members set
      last_seen_at  = last_seen_at  - v_iv,
      last_daily_at = last_daily_at - v_iv,
      last_feed_at  = last_feed_at  - v_iv,
      last_water_at = last_water_at - v_iv,
      last_pet_at   = last_pet_at   - v_iv
      where pair_id = p_pair;
    perform recompute_pair(p_pair);   -- settle decay / dormancy / streak for the elapsed time
  else
    perform _recompute_wellbeing(p_pair);
  end if;

  select * into st from bixi_state where pair_id = p_pair;
  return st;
end; $function$;

revoke all on function public.dev_set_state(uuid, numeric, numeric, numeric, integer, text, boolean, text, boolean, bigint) from public, anon;
grant execute on function public.dev_set_state(uuid, numeric, numeric, numeric, integer, text, boolean, text, boolean, bigint) to authenticated;
