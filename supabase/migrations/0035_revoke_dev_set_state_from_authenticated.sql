-- Harden: the admin day-skip / state-patch RPC (dev_set_state) must never be
-- callable by a normal signed-in user. The dev-tools UI is already build-gated
-- (DEV_TOOLS is false in the production build), but the RPC grant to
-- `authenticated` in 0015 left the door open for a crafted direct call that
-- could fake streak/bond/growth/time. Revoke it — service role only from here.
--
-- Note: this disables the admin panel's day-skip in preview/dev builds too. If
-- you need it back for a local dev session, re-grant temporarily:
--   grant execute on function public.dev_set_state(uuid,numeric,numeric,numeric,integer,text,boolean,text,boolean,bigint) to authenticated;
revoke execute on function public.dev_set_state(
  uuid, numeric, numeric, numeric, integer, text, boolean, text, boolean, bigint
) from authenticated;
