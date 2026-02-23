create table if not exists users (
  id bigserial primary key,
  name text not null,
  user_id text not null unique,
  game_name text not null unique,
  location text not null default '',
  email text not null unique,
  phone text not null default '',
  password_hash text not null,
  status text not null default 'pending',
  role text not null default 'user',
  contest_manager_contest_id text,
  reset_token text,
  reset_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_email_lower on users (lower(email));
create index if not exists idx_users_game_name_lower on users (lower(game_name));
create index if not exists idx_users_user_id_lower on users (lower(user_id));
