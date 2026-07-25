-- ============================================================================
-- 0022: Bond is ALWAYS synced — both keepers held at the pair max.
--
-- APPLIED LIVE (mvyktmxkhwigrrftsbpn) on 2026-07-21 as `bond_always_synced_0022`.
-- Mirrored into the repo here (it was missing — the live DB had it, the folder
-- did not).
--
-- Background: since 0015 every bond WRITE already targets the whole pair
-- (`where pair_id = p_pair`), so both keepers move by the same delta. But equal
-- deltas PRESERVE any pre-existing gap — a divergence created before the shared
-- model (Waleed 31 vs Saud 26) would ride along forever, converging only when
-- both clamp at 0 or 100. This adds the missing ONGOING guardrail: on every
-- recompute, force both keepers to the pair's best (max) bond BEFORE mood reads
-- avg(bond). Because apply_care / recompute_pair / dev_set_state all end by
-- calling _recompute_wellbeing, divergence is now structurally impossible — the
-- "one stomach" the concept always wanted.
-- ============================================================================

-- one-time: converge any currently-divergent pair to its best value
update pair_members m set bond = sub.mx
from (select pair_id, max(bond) as mx from pair_members group by pair_id) sub
where m.pair_id = sub.pair_id and m.bond is distinct from sub.mx;

create or replace function public._recompute_wellbeing(p_pair uuid)
 returns numeric language plpgsql security definer set search_path to 'public'
as $function$
declare k jsonb := _bixi_const(); st bixi_state%rowtype;
        v_members int; v_ceiling numeric; v_avgbond numeric; v_w numeric;
        v_secret boolean; v_dance boolean;
begin
  select * into st from bixi_state where pair_id = p_pair for update;
  if st.pair_id is null then return null; end if;

  -- bond is shared: force both keepers to the pair max before anything reads it
  update pair_members set bond = sub.mx
    from (select max(bond) as mx from pair_members where pair_id = p_pair) sub
    where pair_id = p_pair and bond is distinct from sub.mx;

  select count(*), coalesce(avg(bond),0) into v_members, v_avgbond from pair_members where pair_id = p_pair;
  v_ceiling := case when v_members >= 2 or st.ever_reached_100
                    then (k->>'ceil_paired')::numeric else (k->>'ceil_solo')::numeric end;
  v_w := round( (k->>'w_feed')::numeric*st.feed + (k->>'w_water')::numeric*st.water
              + (k->>'w_bond')::numeric*v_avgbond, 1);
  v_w := greatest(0, least(v_ceiling, v_w));
  v_secret := v_w >= (k->>'secret_at')::numeric and not ('secret1' = any(st.unlocked_secrets));
  v_dance  := v_w >= (k->>'dance_at')::numeric  and not ('dance'   = any(st.unlocked_secrets));
  if v_w = st.mood and not v_secret and not v_dance then return v_w; end if;
  update bixi_state set mood = v_w, mood_updated_at = now(), updated_at = now(),
    unlocked_secrets = (select array(select distinct unnest(
        unlocked_secrets
        || case when v_secret then array['secret1'] else array[]::text[] end
        || case when v_dance  then array['dance']   else array[]::text[] end)))
    where pair_id = p_pair;
  return v_w;
end; $function$;
