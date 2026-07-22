-- ============================================================================
-- 0007 — production fixes & missing features (applied live 2026-07-20)
--
-- 1) recompute_pair: idempotent decay (was re-subtracting the full accumulated
--    amount on every run) + correct unforgiving streak break (per-keeper rolling
--    24h DAILY window, with a joined_at grace for fresh joiners — was keying on
--    "any interaction", which let feeding freeze a streak forever).
-- 2) invite_preview: resolve a code/token to the real inviter + Bixi before
--    claiming (Join confirm card).
-- 3) both_here: the "both here now" live moment (+3 mood, once per 20h,
--    server-enforced).
-- 4) Leave flow: request_leave / undo_leave (24h cooling-off), set_partner_mute
--    (immediate safety mute), process_leaves (cron: executes cooled-off leaves +
--    ghost auto-revert so a lone keeper is never trapped waiting on a dormant
--    partner forever).
-- 5) Membership-delete trigger keeps revive_pending consistent (a removed
--    keeper can no longer block a revive).
-- 6) Grant/revoke hygiene.
-- ============================================================================

-- ---------- columns ----------
alter table public.bixi_state   add column if not exists last_both_here_at timestamptz;
alter table public.pair_members add column if not exists leave_requested_at timestamptz;
alter table public.pair_members add column if not exists muted boolean not null default false;

-- ---------- 1) recompute_pair (fixed) ----------
create or replace function public.recompute_pair(p_pair uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare k jsonb := _bixi_const(); st bixi_state%rowtype;
        v_members int; v_paired boolean; v_last_seen timestamptz;
        v_neglect_h numeric; v_drift_all boolean; v_daily_lapsed boolean;
        v_decay_rate numeric; v_from timestamptz; v_hours numeric; v_dec numeric;
begin
  -- callable by cron (no auth) or by a member on app-open; never by outsiders
  if auth.uid() is not null and not is_pair_member(p_pair) then
    raise exception 'not_a_member';
  end if;

  select * into st from bixi_state where pair_id = p_pair for update;
  if st.pair_id is null then return; end if;
  select count(*) into v_members from pair_members where pair_id = p_pair;
  v_paired := v_members >= 2;

  select max(last_seen_at) into v_last_seen from pair_members where pair_id = p_pair;
  v_last_seen := coalesce(v_last_seen, (select hatched_at from pairs where id = p_pair));
  if v_last_seen is null then return; end if;
  v_neglect_h := extract(epoch from (now() - v_last_seen)) / 3600.0;

  -- decay: only after one fully neglected cycle, and IDEMPOTENT — each run
  -- decays only the span since the later of (mood_updated_at, neglect start)
  if v_neglect_h > (k->>'window_h')::numeric then
    v_decay_rate := case when v_paired then (k->>'decay_paired')::numeric
                         else (k->>'decay_solo')::numeric end;
    v_from  := greatest(st.mood_updated_at,
                        v_last_seen + make_interval(hours => (k->>'window_h')::int));
    v_hours := extract(epoch from (now() - v_from)) / 3600.0;
    if v_hours > 0 then
      v_dec := v_decay_rate * v_hours / 24.0;
      update bixi_state
         set mood = greatest(0, mood - v_dec),
             mood_updated_at = now(), updated_at = now()
       where pair_id = p_pair;
    end if;
  end if;

  -- dormant: solo 48h of nobody; paired only when BOTH have drifted past 24h
  select bool_and(last_seen_at is null
           or now() - last_seen_at > make_interval(hours => (k->>'sad_hours')::int))
    into v_drift_all from pair_members where pair_id = p_pair;
  if not st.dormant and (
       (not v_paired and v_neglect_h > (k->>'dormant_solo_h')::numeric)
    or (v_paired and v_drift_all and v_neglect_h > (k->>'dormant_paired_h')::numeric)
  ) then
    update bixi_state set dormant = true, updated_at = now(),
      revive_pending = case when v_paired
        then (select array_agg(profile_id) from pair_members where pair_id = p_pair)
        else '{}' end
      where pair_id = p_pair;
  end if;

  -- unforgiving streak: each keeper has a rolling 24h DAILY clock (from their
  -- last daily, or from joining for a keeper who hasn't done one yet)
  if st.streak > 0 then
    select bool_or(now() - coalesce(last_daily_at, joined_at) > interval '24 hours')
      into v_daily_lapsed from pair_members where pair_id = p_pair;
    if v_daily_lapsed then
      update bixi_state set streak = 0, updated_at = now() where pair_id = p_pair;
    end if;
  end if;
end; $function$;

create or replace function public.recompute_all()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r record;
begin
  for r in select pair_id from bixi_state loop
    perform recompute_pair(r.pair_id);
  end loop;
end; $function$;

-- ---------- 2) invite preview ----------
create or replace function public.invite_preview(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_inv invites%rowtype; v_name text; v_bixi text; v_kind text; v_day int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_inv from invites
    where token = p_token or upper(code) = upper(p_token)
    order by created_at desc limit 1;
  if not found then raise exception 'invalid_invite'; end if;
  if v_inv.claimed_by is not null then raise exception 'invite_used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite_expired'; end if;

  select coalesce(pr.display_name, 'Your person'), p.bixi_name, p.relationship_kind,
         greatest(1, floor(extract(epoch from (now() - coalesce(p.hatched_at, p.created_at))) / 86400)::int + 1)
    into v_name, v_bixi, v_kind, v_day
    from pairs p
    left join profiles pr on pr.id = v_inv.created_by
   where p.id = v_inv.pair_id;

  return jsonb_build_object(
    'inviter_name', v_name, 'bixi_name', v_bixi,
    'relationship_kind', v_kind, 'day', v_day, 'expires_at', v_inv.expires_at);
end; $function$;

-- ---------- 3) "both here now" ----------
create or replace function public.both_here(p_pair uuid)
 returns bixi_state
 language plpgsql
 set search_path to 'public'
as $function$
declare k jsonb := _bixi_const(); st bixi_state%rowtype; v_members int; v_ceiling numeric;
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  select * into st from bixi_state where pair_id = p_pair for update;
  select count(*) into v_members from pair_members where pair_id = p_pair;
  if v_members < 2 or st.dormant then return st; end if;
  if st.last_both_here_at is not null
     and now() - st.last_both_here_at < interval '20 hours' then
    return st;  -- already celebrated this cycle
  end if;
  v_ceiling := case when st.ever_reached_100 or v_members >= 2 then 100 else 70 end;
  update bixi_state
     set mood = least(v_ceiling, mood + 3),
         last_both_here_at = now(), mood_updated_at = now(), updated_at = now()
   where pair_id = p_pair;
  select * into st from bixi_state where pair_id = p_pair;
  return st;
end; $function$;

-- ---------- 4) leave flow ----------
create or replace function public.request_leave(p_pair uuid)
 returns timestamptz
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  update pair_members set leave_requested_at = now()
   where pair_id = p_pair and profile_id = auth.uid();
  return now() + interval '24 hours';
end; $function$;

create or replace function public.undo_leave(p_pair uuid)
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  update pair_members set leave_requested_at = null
   where pair_id = p_pair and profile_id = auth.uid();
end; $function$;

create or replace function public.set_partner_mute(p_pair uuid, p_muted boolean)
 returns void
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  update pair_members set muted = coalesce(p_muted, false)
   where pair_id = p_pair and profile_id = auth.uid();
end; $function$;

-- cron: execute cooled-off leaves + ghost auto-revert (Area 11 escape hatch)
create or replace function public.process_leaves()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- 24h cooling-off elapsed → the leave actually happens
  delete from pair_members where leave_requested_at < now() - interval '24 hours';

  -- ghost auto-revert: pair is dormant, one keeper gone 30+ days while the
  -- other has shown up within 7 days → remove the ghost so the remaining
  -- keeper's Bixi becomes a solo unit (and can be revived alone)
  delete from pair_members m
   where coalesce(m.last_seen_at, m.joined_at) < now() - interval '30 days'
     and exists (select 1 from bixi_state s where s.pair_id = m.pair_id and s.dormant)
     and exists (select 1 from pair_members o
                  where o.pair_id = m.pair_id and o.profile_id <> m.profile_id
                    and o.last_seen_at > now() - interval '7 days');
end; $function$;

-- ---------- 5) membership-delete consistency ----------
-- A removed keeper must not linger in revive_pending (would block a revive
-- forever) and their unclaimed invites are void.
create or replace function public.handle_member_removed_state()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update bixi_state
     set revive_pending = array_remove(revive_pending, old.profile_id)
   where pair_id = old.pair_id and old.profile_id = any(revive_pending);
  delete from invites
   where pair_id = old.pair_id and created_by = old.profile_id and claimed_by is null;
  return old;
end; $function$;

drop trigger if exists on_member_removed_state on public.pair_members;
create trigger on_member_removed_state
  after delete on public.pair_members
  for each row execute function public.handle_member_removed_state();

-- ---------- 6) grants ----------
revoke all on function public.recompute_pair(uuid)            from public, anon;
revoke all on function public.recompute_all()                 from public, anon, authenticated;
revoke all on function public.process_leaves()                from public, anon, authenticated;
revoke all on function public.invite_preview(text)            from public, anon;
revoke all on function public.both_here(uuid)                 from public, anon;
revoke all on function public.request_leave(uuid)             from public, anon;
revoke all on function public.undo_leave(uuid)                from public, anon;
revoke all on function public.set_partner_mute(uuid, boolean) from public, anon;
grant execute on function public.recompute_pair(uuid)            to authenticated;
grant execute on function public.invite_preview(text)            to authenticated;
grant execute on function public.both_here(uuid)                 to authenticated;
grant execute on function public.request_leave(uuid)             to authenticated;
grant execute on function public.undo_leave(uuid)                to authenticated;
grant execute on function public.set_partner_mute(uuid, boolean) to authenticated;
-- hygiene: these were still executable by anon (they'd fail on auth.uid() but
-- shouldn't even be callable)
revoke execute on function public.create_bixi(text, text, boolean) from anon, public;
revoke execute on function public.create_invite(uuid)              from anon, public;
revoke execute on function public.apply_care(uuid, text, boolean, text, text) from anon, public;
revoke execute on function public.revive(uuid)                     from anon, public;
revoke execute on function public.leave_pair(uuid)                 from anon, public;

-- ---------- 7) create_invite pgcrypto fix (caught by the E2E suite) ----------
-- search_path was pinned to 'public' but pgcrypto lives in 'extensions' on
-- Supabase → gen_random_bytes() unresolvable → invite minting failed at runtime.
create or replace function public.create_invite(p_pair uuid)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'extensions'
as $function$
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
end; $function$;

revoke execute on function public.create_invite(uuid) from anon, public;
grant execute on function public.create_invite(uuid) to authenticated;
