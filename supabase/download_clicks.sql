-- Run this ONCE in your Sprout Supabase project (ihqhofeubfqphzegiapl)
-- Dashboard → SQL Editor → paste → Run.
-- Creates the table that records every "Download the app" click from the landing page.

create table if not exists public.download_clicks (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  path        text,
  referrer    text,
  user_agent  text
);

-- lock the table, then allow ONLY anonymous inserts (same pattern as the waitlist).
-- Safe to re-run: drop-then-create means no "policy already exists" error.
alter table public.download_clicks enable row level security;
grant insert on public.download_clicks to anon;

drop policy if exists "anon insert download_clicks" on public.download_clicks;
create policy "anon insert download_clicks"
  on public.download_clicks for insert to anon
  with check (true);
