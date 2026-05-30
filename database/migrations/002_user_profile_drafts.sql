create table if not exists user_profile_drafts (
  user_id text primary key references users(id) on delete cascade,
  username text not null,
  email text,
  rating numeric(3, 1) not null default 0.0 check (rating between 0 and 5),
  transaction_count integer not null default 0,
  genres jsonb not null default '[]'::jsonb,
  email_verified boolean not null default true,
  updated_at timestamptz not null default now()
);
