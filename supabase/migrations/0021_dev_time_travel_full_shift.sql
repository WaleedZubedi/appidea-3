-- ============================================================================
-- 0021: dev_set_state time-travel shifts EVERY time-derived timestamp so a skip
-- is 100% accurate — meters/mood/bond/streak/dormancy/day-counter AND the
-- journal (care_events + milestones + join dates) all follow. Setting streak
-- also updates growth_stage. APPLIED LIVE (mvyktmxkhwigrrftsbpn) 2026-07-21 as
-- `dev_time_travel_full_shift_0021`.
-- Verified: skip 7d from feed90/water80/bond60/streak15 -> feed76 water66 bond46
-- mood61.0 streak0, hatched_at & care_events shifted exactly 7.00 days.
-- ============================================================================
create or replace function public.dev_set_state(
  p_pair uuid, p_feed numeric default null, p_water numeric default null, p_bond numeric default null,
  p_streak integer default null, p_growth text default null, p_dormant boolean default null,
  p_daily text default null, p_clear_cooldowns boolean default null, p_advance_ms bigint default null
) returns bixi_state language plpgsql security definer set search_path to 'public'
as $function$
declare st bixi_state%rowtype; v_iv interval; v_paired boolean;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  v_paired := (select count(*) from pair_members where pair_id = p_pair) >= 2;

  if p_feed is not null then
    update bixi_state set feed = greatest(0, least(100, p_feed)), vitals_updated_at = now(), updated_at = now() where pair_id = p_pair;
  end if;
  if p_water is not null then
    update bixi_state set water = greatest(0, least(100, p_water)), vitals_updated_at = now(), updated_at = now() where pair_id = p_pair;
  end if;
  if p_bond is not null then
    update pair_members set bond = greatest(0, least(100, p_bond)) where pair_id = p_pair;
  end if;
  if p_streak is not null then
    update bixi_state set streak = greatest(0, p_streak),
      best_streak = greatest(best_streak, greatest(0, p_streak)),
      growth_stage = _stage_for(greatest(0, p_streak), v_paired),
      has_companion = has_companion or _stage_for(greatest(0, p_streak), v_paired) = 'fullbloom',
      last_streak_day_at = now(), updated_at = now()
      where pair_id = p_pair;
    update pair_members set last_daily_at = now(), last_seen_at = now() where pair_id = p_pair;
  end if;
  if p_growth is not null then
    update bixi_state set growth_stage = p_growth, has_companion = has_companion or p_growth = 'fullbloom', updated_at = now() where pair_id = p_pair;
  end if;
  if p_dormant is not null then
    if p_dormant then
      update bixi_state set dormant = true, updated_at = now() where pair_id = p_pair;
    else
      update bixi_state set dormant = false, revive_pending = '{}', vitals_updated_at = now(), updated_at = now() where pair_id = p_pair;
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
    update pairs set hatched_at = hatched_at - v_iv, bloomed_at = bloomed_at - v_iv, created_at = created_at - v_iv where id = p_pair;
    update pair_members set
      joined_at = joined_at - v_iv, last_seen_at = last_seen_at - v_iv, last_daily_at = last_daily_at - v_iv,
      last_feed_at = last_feed_at - v_iv, last_water_at = last_water_at - v_iv, last_pet_at = last_pet_at - v_iv
      where pair_id = p_pair;
    update care_events set created_at = created_at - v_iv where pair_id = p_pair;
    update milestones  set created_at = created_at - v_iv where pair_id = p_pair;
    perform recompute_pair(p_pair);
  else
    perform _recompute_wellbeing(p_pair);
  end if;

  select * into st from bixi_state where pair_id = p_pair;
  return st;
end; $function$;
