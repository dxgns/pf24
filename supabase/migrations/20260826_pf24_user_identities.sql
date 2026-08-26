create table if not exists public.pf24_user_identities (
  discord_id text primary key,
  roblox_user_id text not null unique,
  roblox_username text not null,
  roblox_display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.pf24_user_identities enable row level security;

-- PF24 writes this table only with the Supabase service-role client from the
-- authentication callback. No browser-facing RLS policy is intentionally added.
create index if not exists pf24_user_identities_roblox_username_idx
  on public.pf24_user_identities (lower(roblox_username));
