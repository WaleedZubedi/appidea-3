-- ============================================================================
-- 0017: Simple mood. APPLIED LIVE (mvyktmxkhwigrrftsbpn) 2026-07-21 as
-- migration `mood_is_flat_accumulator_0017`. Recorded here for the repo.
--
-- Mood is now a flat accumulator: each action raises bixi_state.mood by 0.2
-- (clamped to the pair ceiling), gated once-per-hour PER action-kind PER keeper
-- (via care_events), decoupled from the feed/water/bond blend. Both parents
-- pour into the same shared mood, streamed live by realtime. The feed/water/
-- bond meters still fill for their action rings; they no longer compute mood.
-- ============================================================================

-- mood is no longer derived from the blend — only handle mood-gated unlocks.
create or replace function public._recompute_wellbeing(p_pair uuid)
 returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare k jsonb := _bixi_const(); st bixi_state%rowtype; v_secret boolean; v_dance boolean;
begin
  select * into st from bixi_state where pair_id = p_pair for update;
  if st.pair_id is null then return null; end if;
  v_secret := st.mood >= (k->>'secret_at')::numeric and not ('secret1' = any(st.unlocked_secrets));
  v_dance  := st.mood >= (k->>'dance_at')::numeric  and not ('dance'   = any(st.unlocked_secrets));
  if v_secret or v_dance then
    update bixi_state set unlocked_secrets = (select array(select distinct unnest(
        unlocked_secrets
        || case when v_secret then array['secret1'] else array[]::text[] end
        || case when v_dance  then array['dance']   else array[]::text[] end)))
      where pair_id = p_pair;
  end if;
  return st.mood;
end; $function$;

create or replace function public.apply_care(p_pair uuid, p_kind text, p_is_daily boolean, p_client_action_id text, p_note text)
 returns bixi_state language plpgsql security definer set search_path to 'public'
as $function$
declare
  k jsonb := _bixi_const(); v_uid uuid := auth.uid();
  v_members int; v_paired boolean; v_inserted boolean := true;
  st bixi_state%rowtype; v_old_seen timestamptz; v_scratch numeric; v_gain numeric;
  v_all_current boolean; v_new_cycle boolean; v_streak int; v_stage text;
  v_last_feed timestamptz; v_last_water timestamptz; v_last_pet timestamptz;
  v_last_kind timestamptz; v_ceil numeric;
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

  -- meter fills (drive the action rings; no longer feed mood)
  if v_paired and v_old_seen is not null
     and now() - v_old_seen > make_interval(hours => (k->>'sad_hours')::int) then
    update pair_members set bond = greatest(0, bond - (k->>'bond_absence_penalty')::numeric)
      where pair_id = p_pair;
  end if;
  if p_is_daily then
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
      v_gain := case when v_last_feed is null or now() - v_last_feed > interval '24 hours'
                     then (k->>'feed_refill')::numeric else (k->>'feed_refill')::numeric / 2 end;
      update bixi_state set feed = least(100, feed + v_gain) where pair_id = p_pair;
      update pair_members set last_feed_at = now() where pair_id = p_pair and profile_id = v_uid;
    end if;
  elsif p_kind = 'water' then
    if v_last_water is null or now() - v_last_water > v_cool then
      v_gain := case when v_last_water is null or now() - v_last_water > interval '24 hours'
                     then (k->>'water_refill')::numeric else (k->>'water_refill')::numeric / 2 end;
      update bixi_state set water = least(100, water + v_gain) where pair_id = p_pair;
      update pair_members set last_water_at = now() where pair_id = p_pair and profile_id = v_uid;
    end if;
  else
    if v_last_pet is null or now() - v_last_pet > v_petcool then
      v_gain := case when v_last_pet is null or now() - v_last_pet > interval '24 hours'
                     then (k->>'bond_pet')::numeric else (k->>'bond_pet')::numeric / 2 end;
      update pair_members set bond = least((k->>'bond_max')::numeric, bond + v_gain) where pair_id = p_pair;
      update pair_members set last_pet_at = now() where pair_id = p_pair and profile_id = v_uid;
    end if;
  end if;

  -- flat +0.2 mood per action, once/hour per (keeper, kind)
  select max(created_at) into v_last_kind from care_events
    where pair_id = p_pair and profile_id = v_uid and kind = p_kind
      and client_action_id is distinct from p_client_action_id;
  if v_last_kind is null or now() - v_last_kind > interval '1 hour' then
    v_ceil := case when v_paired or st.ever_reached_100
                   then (k->>'ceil_paired')::numeric else (k->>'ceil_solo')::numeric end;
    update bixi_state set mood = least(v_ceil, mood + 0.2), mood_updated_at = now(), updated_at = now()
      where pair_id = p_pair;
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
