-- ============================================================================
-- 0025: Harden join_other + invite_preview.  APPLIED LIVE (mvyktmxkhwigrrftsbpn)
-- as `harden_join_other_self_guard_0025`.
--
-- join_other now validates the target invite BEFORE touching the caller's
-- membership and refuses a self-join (entering your own code) with a clear
-- `cannot_join_own_bixi` error instead of pointlessly attempting the destructive
-- delete. Both the delete and claim_invite run in one transaction, so any
-- failure still rolls back the delete. invite_preview also rejects the caller's
-- own invite so the "join" confirm screen never appears for your own code.
--
-- NOTE: join_other / claim_invite / invite_preview otherwise live only in the
-- DB (were applied directly, not previously mirrored). This migration re-defines
-- join_other and invite_preview; claim_invite is unchanged.
-- ============================================================================

create or replace function public.join_other(p_token text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_pair uuid; v_cnt int; v_inv invites%rowtype;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select * into v_inv from invites
    where token = p_token or upper(code) = upper(p_token)
    order by created_at desc limit 1;
  if not found then raise exception 'invalid_invite'; end if;
  if v_inv.claimed_by is not null then raise exception 'invite_used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite_expired'; end if;

  select pair_id into v_pair from pair_members where profile_id = v_uid limit 1;
  if v_pair is not null then
    if v_inv.pair_id = v_pair then raise exception 'cannot_join_own_bixi'; end if;
    select count(*) into v_cnt from pair_members where pair_id = v_pair;
    if v_cnt >= 2 then raise exception 'leave_partner_first'; end if;
    delete from pair_members where pair_id = v_pair and profile_id = v_uid;
  end if;

  return public.claim_invite(v_inv.token);
end; $function$;

create or replace function public.invite_preview(p_token text)
 returns jsonb language plpgsql security definer set search_path to 'public'
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
  if exists (select 1 from pair_members where pair_id = v_inv.pair_id and profile_id = auth.uid()) then
    raise exception 'cannot_join_own_bixi';
  end if;

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
