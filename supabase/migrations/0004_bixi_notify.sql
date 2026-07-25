-- ============================================================================
-- Notification targeting (Area 6). Service-role only; called by the `notify`
-- Edge Function on a schedule. Returns keepers whose streak is at risk:
-- their last daily was 20–24h ago (the "Bixi misses you" window).
-- ============================================================================

create or replace function public.nudge_targets()
returns table(profile_id uuid, push_token text, bixi_name text, streak int)
language sql
security definer
stable
set search_path = public
as $$
  select m.profile_id, pr.push_token, p.bixi_name, s.streak
  from public.pair_members m
  join public.profiles pr on pr.id = m.profile_id
  join public.pairs p     on p.id = m.pair_id
  join public.bixi_state s on s.pair_id = m.pair_id
  where pr.push_token is not null
    and m.last_daily_at is not null
    and now() - m.last_daily_at between interval '20 hours' and interval '24 hours'
    and not s.dormant;
$$;

revoke execute on function public.nudge_targets() from anon, authenticated, public;
