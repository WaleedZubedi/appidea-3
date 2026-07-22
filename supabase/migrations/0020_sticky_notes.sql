-- ============================================================================
-- 0020: Sticky notes between the two keepers (EXPERIMENTAL / testing).
-- APPLIED LIVE (mvyktmxkhwigrrftsbpn) 2026-07-21 as `sticky_notes_0020`.
-- Pair-scoped, member-readable, author-writable, realtime-synced.
-- To remove: drop table public.notes; and delete the client bits
-- (mobile/src/ui/StickyNotes.tsx, the api note fns, the Home entry point).
-- ============================================================================
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  color text,
  created_at timestamptz not null default now()
);
create index if not exists notes_pair_created_idx on public.notes (pair_id, created_at desc);

alter table public.notes enable row level security;
drop policy if exists notes_read on public.notes;
create policy notes_read on public.notes for select using (is_pair_member(pair_id));
drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes for insert with check (author_id = auth.uid() and is_pair_member(pair_id));
drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes for delete using (author_id = auth.uid());

grant select, insert, delete on public.notes to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.notes;
exception when duplicate_object then null; end $$;
alter table public.notes replica identity full;
