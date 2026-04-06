create table if not exists scoring_rules (
  id bigserial primary key,
  tournament_id bigint not null unique,
  rules jsonb not null default '{"batting": [], "bowling": [], "fielding": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint fk_scoring_rules_tournament foreign key (tournament_id) references tournaments (id) on delete cascade
);

create index if not exists idx_scoring_rules_tournament_id on scoring_rules (tournament_id);
