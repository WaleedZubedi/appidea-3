-- ============================================================================
-- 0016: Gentle economy. APPLIED LIVE (mvyktmxkhwigrrftsbpn) 2026-07-21 as
-- migration `gentle_economy_1pct_0016`. Recorded here for the repo.
--
-- Each action fills its meter by 1% the first time in 24h, and 0.5% on a
-- same-day repeat (cooldown still gates to hourly). Vitals + bond decay 2%/day.
-- Client mirror: mobile/src/game/engine.ts VITALS.
-- ============================================================================

create or replace function public._bixi_const()
 returns jsonb language sql immutable set search_path to 'public'
as $function$
  select jsonb_build_object(
    'gain_daily', 2, 'gain_perm', 1,
    'sad_hours', 24, 'dormant_solo_h', 48, 'dormant_paired_h', 24,
    'window_h', 24, 'ceil_solo', 70, 'ceil_paired', 100,
    'secret_at', 80, 'dance_at', 90, 'graduation', 100,
    'feed_refill', 1, 'water_refill', 1,
    'feed_decay', 2, 'water_decay', 2,
    'vital_cooldown_h', 1, 'pet_cooldown_h', 1,
    'bond_daily', 1, 'bond_pet', 1, 'bond_decay', 2, 'bond_absence_penalty', 2,
    'bond_max', 100, 'both_here_bump', 1,
    'w_feed', 0.30, 'w_water', 0.30, 'w_bond', 0.40,
    'starved_at', 15, 'revive_vital', 25,
    'hatch_vital', 60, 'bloom_vital', 70, 'bond_start', 20
  );
$function$;

-- apply_care: first-of-day (full) vs same-day-repeat (half) gains for feed/water/pet.
create or replace function public.apply_care(p_pair uuid, p_kind text, p_is_daily boolean, p_client_action_id text, p_note text)
 returns bixi_state language plpgsql security definer set search_path to 'public'
as $function$
declare
  k jsonb := _bixi_const(); v_uid uuid := auth.uid();
  v_members int; v_paired boolean; v_inserted boolean := true;
  st bixi_state%rowtype; v_old_seen timestamptz; v_scratch numeric; v_gain numeric;
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
