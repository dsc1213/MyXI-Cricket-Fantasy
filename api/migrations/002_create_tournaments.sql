create table if not exists tournaments (
  id bigserial primary key,
  name text not null,
  season text not null default 'default',
  status text not null default 'active',
  source_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tournaments_source_key on tournaments (source_key);
create index if not exists idx_tournaments_status on tournaments (status);
create index if not exists idx_tournaments_created_at on tournaments (created_at desc);
