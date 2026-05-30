create extension if not exists "uuid-ossp";

create table users (
  id text primary key,
  username text not null unique,
  email text not null unique,
  phone text,
  password_hash text,
  auth_provider text not null default 'password',
  google_sub text unique,
  avatar_url text,
  rating numeric(3, 1) not null default 0.0 check (rating between 0 and 5),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  email_verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_genres (
  user_id text not null references users(id) on delete cascade,
  genre text not null,
  primary key (user_id, genre)
);

create table user_profile_drafts (
  user_id text primary key references users(id) on delete cascade,
  username text not null,
  email text,
  rating numeric(3, 1) not null default 0.0 check (rating between 0 and 5),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  genres jsonb not null default '[]'::jsonb,
  email_verified boolean not null default true,
  updated_at timestamptz not null default now()
);

create table password_reset_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null references users(id) on delete cascade,
  reset_code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table listings (
  id text primary key,
  seller_id text not null references users(id) on delete cascade,
  title text not null,
  artist text,
  release_year integer,
  genre text,
  catalog_number text,
  matrix_number text,
  price integer not null check (price >= 0),
  description text,
  tags jsonb not null default '[]'::jsonb,
  jacket_grade text,
  jacket_score integer check (jacket_score between 0 and 100),
  audio_grade text,
  audio_score integer check (audio_score between 0 and 100),
  audio_samples jsonb not null default '{}'::jsonb,
  analysis_report jsonb not null default '{}'::jsonb,
  is_rare boolean not null default false,
  is_first_press boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'published', 'reserved', 'sold', 'hidden')),
  location text,
  views integer not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table listing_images (
  id uuid primary key default uuid_generate_v4(),
  listing_id text not null references listings(id) on delete cascade,
  storage_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table user_listing_drafts (
  user_id text primary key references users(id) on delete cascade,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table lp_recognition_analyses (
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

create table jacket_condition_analyses (
  id uuid primary key default uuid_generate_v4(),
  listing_id text references listings(id) on delete set null,
  filename text,
  content_type text,
  file_size integer not null default 0 check (file_size >= 0),
  jacket_score integer not null check (jacket_score between 0 and 100),
  jacket_grade text not null,
  corner_wear text,
  ring_wear text,
  stain_risk text,
  tear_or_crease_risk text,
  details jsonb not null default '{}'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  source text not null default 'opencv',
  created_at timestamptz not null default now()
);

create table audio_sample_analyses (
  id uuid primary key default uuid_generate_v4(),
  listing_id text references listings(id) on delete set null,
  audio_score integer not null check (audio_score between 0 and 100),
  audio_grade text not null,
  playback_risk text,
  click_count integer not null default 0,
  noise_floor_db numeric(6, 2),
  dynamic_range_db numeric(6, 2),
  good_sample jsonb,
  noisy_sample jsonb,
  summary text,
  source text not null default 'librosa',
  created_at timestamptz not null default now()
);

create table favorites (
  user_id text not null references users(id) on delete cascade,
  listing_id text not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  listing_id text not null references listings(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  content text not null,
  parent_id uuid references comments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default uuid_generate_v4(),
  listing_id text not null references listings(id) on delete cascade,
  buyer_id text not null references users(id) on delete cascade,
  offer_price integer not null check (offer_price >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  listing_id text not null references listings(id) on delete cascade,
  buyer_id text not null references users(id) on delete cascade,
  seller_id text not null references users(id) on delete cascade,
  price integer not null check (price >= 0),
  status text not null default 'selling' check (status in ('selling', 'reserved', 'completed', 'cancelled')),
  buyer_checked boolean not null default false,
  seller_checked boolean not null default false,
  meeting_location text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table chats (
  id text primary key,
  transaction_id uuid references transactions(id) on delete cascade,
  listing_id text references listings(id) on delete cascade,
  buyer_id text references users(id) on delete cascade,
  seller_id text references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id text primary key,
  chat_id text not null references chats(id) on delete cascade,
  sender_id text not null references users(id) on delete cascade,
  sender_name text,
  content text not null,
  message_type text not null default 'text',
  created_at timestamptz not null default now()
);

create table reviews (
  id text primary key,
  transaction_id uuid references transactions(id) on delete set null,
  album_id text references listings(id) on delete set null,
  album_title text,
  reviewer_id text not null references users(id) on delete cascade,
  reviewer_name text,
  reviewee_id text not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null references users(id) on delete cascade,
  type text not null check (type in ('offer', 'chat', 'listing', 'favorite', 'system')),
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_listings_seller_id on listings(seller_id);
create index idx_listings_status_created_at on listings(status, created_at desc);
create index idx_listing_images_listing_id on listing_images(listing_id);
create index idx_comments_listing_id_created_at on comments(listing_id, created_at);
create index idx_offers_listing_id on offers(listing_id);
create index idx_offers_buyer_id on offers(buyer_id);
create index idx_transactions_buyer_id on transactions(buyer_id);
create index idx_transactions_seller_id on transactions(seller_id);
create index idx_chats_listing_id on chats(listing_id);
create index idx_messages_chat_id_created_at on messages(chat_id, created_at);
create index idx_reviews_reviewee_id_created_at on reviews(reviewee_id, created_at desc);
create index idx_notifications_user_id_created_at on notifications(user_id, created_at desc);
