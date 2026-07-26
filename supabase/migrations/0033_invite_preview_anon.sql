-- Allow previewing an invite BEFORE signing up, so a prospective co-parent sees
-- who invited them + the Bixi name on the sign-up screen. Still validates the
-- code (invalid/used/expired). The cannot_join_own_bixi check only applies when
-- a user is already authenticated.
CREATE OR REPLACE FUNCTION public.invite_preview(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_inv invites%rowtype; v_name text; v_bixi text; v_kind text; v_day int;
begin
  select * into v_inv from invites
    where token = p_token or upper(code) = upper(p_token)
    order by created_at desc limit 1;
  if not found then raise exception 'invalid_invite'; end if;
  if v_inv.claimed_by is not null then raise exception 'invite_used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if auth.uid() is not null and exists (
       select 1 from pair_members where pair_id = v_inv.pair_id and profile_id = auth.uid()
     ) then
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

grant execute on function public.invite_preview(text) to anon;
