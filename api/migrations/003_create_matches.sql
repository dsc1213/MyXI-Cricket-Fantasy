create table if not exists matches (
  id bigserial primary key,
  tournament_id bigint not null,
  name text not null,
  team_a text not null,
  team_b text not null,
  team_a_key text,
  team_b_key text,
  start_time timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint fk_matches_tournament foreign key (tournament_id) references tournaments (id) on delete cascade
);

create index if not exists idx_matches_tournament_id on matches (tournament_id);
create index if not exists idx_matches_status on matches (status);
create index if not exists idx_matches_start_time on matches (start_time asc);
create index if not exists idx_matches_created_at on matches (created_at desc);
