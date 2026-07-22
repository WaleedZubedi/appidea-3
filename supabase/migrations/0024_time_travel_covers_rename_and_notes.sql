-- ============================================================================
-- 0024: Time-travel now advances the two newest time-derived values.
--
-- APPLIED LIVE (mvyktmxkhwigrrftsbpn) on 2026-07-21 as
-- `time_travel_covers_rename_and_notes_0024`.
--
-- The admin day-skip (dev_set_state p_advance_ms) shifts every stored timestamp
-- BACKWARD so all time-derived state settles as if that long had passed. 0023
-- added two new ones that weren't in the shift: pairs.bixi_name_changed_at (the
-- monthly-rename cooldown) and notes.created_at (the 6-hour note cooldown). This
-- redefinition adds both so a skip unlocks them exactly like everything else.
-- Only the advance block changed vs the 0021/live definition.
-- ============================================================================

create or replace function public.dev_set_state(p_pair uuid, p_feed numeric DEFAULT NULL::numeric, p_water numeric DEFAULT NULL::numeric, p_bond numeric DEFAULT NULL::numeric, p_streak integer DEFAULT NULL::integer, p_growth text DEFAULT NULL::text, p_dormant boolean DEFAULT NULL::boolean, p_daily text DEFAULT NULL::text, p_clear_cooldowns boolean DEFAULT NULL::boolean, p_advance_ms bigint DEFAULT NULL::bigint)
 RETURNS bixi_state
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    update pairs set
      hatched_at = hatched_at - v_iv,
      bloomed_at = bloomed_at - v_iv,
      created_at = created_at - v_iv,
      bixi_name_changed_at = bixi_name_changed_at - v_iv
      where id = p_pair;
    update pair_members set
      joined_at     = joined_at     - v_iv,
      last_seen_at  = last_seen_at  - v_iv,
      last_daily_at = last_daily_at - v_iv,
      last_feed_at  = last_feed_at  - v_iv,
      last_water_at = last_water_at - v_iv,
      last_pet_at   = last_pet_at   - v_iv
      where pair_id = p_pair;
    -- the journal + notes follow too
    update care_events set created_at = created_at - v_iv where pair_id = p_pair;
    update milestones  set created_at = created_at - v_iv where pair_id = p_pair;
    update notes       set created_at = created_at - v_iv where pair_id = p_pair;
    perform recompute_pair(p_pair);  -- settle decay / dormancy / streak-reset for the elapsed time
  else
    perform _recompute_wellbeing(p_pair);
  end if;

  select * into st from bixi_state where pair_id = p_pair;
  return st;
end; $function$;
