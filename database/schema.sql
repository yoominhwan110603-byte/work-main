create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4(),
  username text not null unique,
  email text not null unique,
  phone text not null,
  password_hash text not null,
  rating numeric(2, 1) not null default 5.0,
  transaction_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table user_genres (
  user_id uuid references users(id) on delete cascade,
  genre text not null,
  primary key (user_id, genre)
);

create table listings (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references users(id) on delete cascade,
  title text not null,
  artist text,
  release_year integer,
  genre text,
  catalog_number text,
  price integer not null,
  description text,
  jacket_grade text,
  audio_grade text,
  audio_score integer,
  is_rare boolean not null default false,
  is_first_press boolean not null default false,
  status text not null default 'published',
  location text,
  created_at timestamptz not null default now()
);

create table listing_images (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_url text not null,
  sort_order integer not null default 0
);

create table audio_samples (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_url text not null,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create table lp_recognition_analyses (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid references listings(id) on delete set null,
  media_type text not null check (media_type in ('image', 'video')),
  filename text,
  content_type text,
  file_size integer not null default 0,
  is_record boolean not null,
  confidence integer not null check (confidence between 0 and 100),
  signals jsonb not null default '[]'::jsonb,
  source text not null default 'heuristic',
  created_at timestamptz not null default now()
);

create table favorites (
  user_id uuid references users(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table comments (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table offers (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid not null references users(id) on delete cascade,
  offer_price integer not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references listings(id) on delete cascade,
  buyer_id uuid not null references users(id) on delete cascade,
  seller_id uuid not null references users(id) on delete cascade,
  price integer not null,
  status text not null default 'selling',
  buyer_checked boolean not null default false,
  seller_checked boolean not null default false,
  completed_at timestamptz
);

create table chats (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references transactions(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  buyer_id uuid references users(id) on delete cascade,
  seller_id uuid references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  chat_id uuid not null references chats(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  content text not null,
  message_type text not null default 'text',
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  reviewer_id uuid not null references users(id) on delete cascade,
  reviewee_id uuid not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  content text,
  created_at timestamptz not null default now()
);
