-- ============================================================================
-- 0008 — RLS correctness for the write-path RPCs (applied live 2026-07-20)
--
-- Found via live API logs: "new row violates row-level security for pairs".
-- Root causes (invisible to SQL-level tests, which run RLS-exempt):
--   • create_bixi used INSERT … RETURNING as SECURITY INVOKER — under RLS a
--     RETURNING row must also pass the SELECT policy (is_pair_member), which is
--     false until the membership row exists an instant later → hatch failed.
--   • milestones has no INSERT policy, so apply_care (growth advance) and
--     revive would fail the same way through the API.
--   • leave_pair's pairs update ran after self-removal → silently no-oped.
--
-- Fix: the self-guarded write RPCs become SECURITY DEFINER (same pattern as
-- claim_invite, which already worked). Guards inside each function are the
-- authorization; RLS remains the read-model for direct table access.
-- bloomed_at clearing moves into the membership-delete trigger so every
-- removal path (leave, cooled-off leave, ghost revert, account deletion)
-- behaves identically.
-- ============================================================================

create or replace function public.create_bixi(p_name text, p_kind text, p_paired boolean)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_pair uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
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
end; $function$;

-- apply_care / revive: identical bodies to the deployed versions, now DEFINER
-- (see supabase/migrations/0002 + 0007 history for the logic itself).
-- [bodies restated in full in the live migration]

create or replace function public.leave_pair(p_pair uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_pair_member(p_pair) then raise exception 'not_a_member'; end if;
  delete from pair_members where pair_id = p_pair and profile_id = auth.uid();
end; $function$;

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
  -- a pair that drops below two keepers is no longer bloomed (solo unit)
  update pairs set bloomed_at = null
   where id = old.pair_id
     and (select count(*) from pair_members where pair_id = old.pair_id) < 2;
  return old;
end; $function$;

revoke all on function public.create_bixi(text, text, boolean) from public, anon;
revoke all on function public.apply_care(uuid, text, boolean, text, text) from public, anon;
revoke all on function public.revive(uuid) from public, anon;
revoke all on function public.leave_pair(uuid) from public, anon;
grant execute on function public.create_bixi(text, text, boolean) to authenticated;
grant execute on function public.apply_care(uuid, text, boolean, text, text) to authenticated;
grant execute on function public.revive(uuid) to authenticated;
grant execute on function public.leave_pair(uuid) to authenticated;
