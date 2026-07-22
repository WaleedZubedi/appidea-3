-- ============================================================================
-- Security hardening for the Bixi functions (from Supabase advisor).
-- ============================================================================

-- pin search_path on the immutable helpers
alter function public._bixi_const()             set search_path = public;
alter function public._stage_for(int, boolean)  set search_path = public;
alter function public._stage_idx(text)          set search_path = public;

-- trigger-only functions must not be callable over the REST API
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.handle_new_pair() from anon, authenticated, public;

-- cron-only compute functions must not be callable by clients
revoke execute on function public.recompute_all()          from anon, authenticated, public;
revoke execute on function public.recompute_pair(uuid)     from anon, authenticated, public;

-- membership helper: RLS (authenticated) needs it, but anon never should
revoke execute on function public.is_pair_member(uuid) from anon, public;

-- joining is for signed-in users only
revoke execute on function public.claim_invite(text) from anon, public;
