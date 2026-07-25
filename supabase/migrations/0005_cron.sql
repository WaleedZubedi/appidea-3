-- ============================================================================
-- Scheduled jobs (Area 6 / PRD §14). APPLIED LIVE 2026-07-20.
-- pg_cron + pg_net enabled. Three jobs:
--   bixi-recompute   */15m — server-authoritative decay/dormant/streak sweep
--   bixi-maintenance hourly — cooled-off leaves + ghost auto-revert
--   bixi-notify      */15m — "Bixi misses you" push via the notify Edge Function
-- The notify function is deployed verify_jwt=false and guarded by the shared
-- x-bixi-cron secret (same value baked in supabase/functions/notify/index.ts).
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('bixi-recompute', '*/15 * * * *', $$ select public.recompute_all(); $$);

select cron.schedule('bixi-maintenance', '7 * * * *', $$ select public.process_leaves(); $$);

select cron.schedule(
  'bixi-notify',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://mvyktmxkhwigrrftsbpn.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bixi-cron', '8c5f44b3eaeb67e270fc3dc8df00698952d54a629e2f8fd3'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- to remove: select cron.unschedule('bixi-recompute'); -- etc.
