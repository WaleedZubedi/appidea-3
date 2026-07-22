-- 0006 — paired-mode fixes (applied live to project mvyktmxkhwigrrftsbpn 2026-07-19)
--
-- 1) Realtime: without the tables in the supabase_realtime publication, Postgres
--    emits no change events, so co-parents never see each other's actions live.
--    replica identity full is required so pair_id-filtered + DELETE events carry
--    the row that the client's postgres_changes filter matches on.
alter publication supabase_realtime add table public.bixi_state;
alter publication supabase_realtime add table public.pair_members;
alter table public.bixi_state   replica identity full;
alter table public.pair_members replica identity full;

-- 2) claim_invite single-use bug: the lookup matched token OR code, but the
--    "mark claimed" UPDATE keyed on p_token, so redeeming by the human BIXI-XXXX
--    code left claimed_by NULL and the invite reusable until expiry. Key the
--    UPDATE on the resolved invite's own token instead.
create or replace function public.claim_invite(p_token text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  update invites set claimed_by = v_uid, claimed_at = now()
    where token = v_inv.token and claimed_by is null;
  update pairs set bloomed_at = coalesce(bloomed_at, now()) where id = v_inv.pair_id;
  update bixi_state set mood = greatest(mood, 50), updated_at = now()
    where pair_id = v_inv.pair_id;
  insert into milestones (pair_id, kind, detail) values (v_inv.pair_id, 'bloom', 'co-parent joined');
  return v_inv.pair_id;
end; $function$;
