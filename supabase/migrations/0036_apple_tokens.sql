-- Stores the Apple OAuth refresh token per user so delete-account can revoke it
-- (App Store Guideline 5.1.1(v)). RLS on with NO policies → only the service
-- role (edge functions) can read/write; end users never see this table. The row
-- is removed automatically when the auth user is deleted.
create table if not exists public.apple_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;
