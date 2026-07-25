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
