create table if not exists user_listing_drafts (
  user_id text primary key,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
