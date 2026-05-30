create extension if not exists "uuid-ossp";

create table if not exists lp_recognition_analyses (
  id uuid primary key default uuid_generate_v4(),
  listing_id text references listings(id) on delete set null,
  media_type text not null check (media_type in ('image', 'video')),
  filename text,
  content_type text,
  file_size integer not null default 0 check (file_size >= 0),
  is_record boolean not null,
  confidence integer not null check (confidence between 0 and 100),
  surface_score integer check (surface_score between 0 and 100),
  scratch_count integer,
  scratch_risk text,
  reflection_risk text,
  signals jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  source text not null default 'heuristic',
  created_at timestamptz not null default now()
);
