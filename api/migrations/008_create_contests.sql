create table if not exists contests (
  id bigserial primary key,
  tournament_id bigint not null,
  name text not null,
  match_ids bigint[] not null default '{}',
  prize_structure jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  entry_fee bigint not null default 0,
  max_participants bigint not null default 100,
  participants_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint fk_contests_tournament foreign key (tournament_id) references tournaments (id) on delete cascade
);

create index if not exists idx_contests_tournament_id on contests (tournament_id);
create index if not exists idx_contests_status on contests (status);
create index if not exists idx_contests_created_at on contests (created_at desc);
