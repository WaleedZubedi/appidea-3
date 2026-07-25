-- ============================================================================
-- 0032: drop the obsolete confirm_signup(text) RPC. APPLIED LIVE
-- (mvyktmxkhwigrrftsbpn) as `drop_confirm_signup`.
--
-- It auto-confirmed a signup's email server-side (no delivery needed) and was
-- executable by `anon` — i.e. anyone could confirm any email, bypassing
-- verification. Now that real email-code verification is wired (signUp ->
-- verifyOtp type 'signup'), the function is unused; removing it closes the hole.
-- ============================================================================
drop function if exists public.confirm_signup(text);
