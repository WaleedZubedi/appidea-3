-- ============================================================================
-- 0031: a profile can belong to at most ONE pair. APPLIED LIVE
-- (mvyktmxkhwigrrftsbpn) as `one_pair_per_profile`.
--
-- The whole app assumes one pair per user (getMyPairId uses maybeSingle). This
-- unique index enforces it in the DB, closing the check-then-act races in
-- create_bixi / claim_invite that produced duplicate pairs and the resulting
-- stale-pairId `not_a_member` errors. Existing data already satisfied it.
-- ============================================================================
create unique index if not exists pair_members_one_pair_per_profile
  on public.pair_members (profile_id);
