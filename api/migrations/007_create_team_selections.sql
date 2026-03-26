create table if not exists team_selections (
  id bigserial primary key,
  match_id bigint not null,
  user_id bigint not null,
  playing_xi integer[] not null default '{}',
  backups integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint fk_team_selections_match foreign key (match_id) references matches (id) on delete cascade,
  constraint fk_team_selections_user foreign key (user_id) references users (id) on delete cascade,
  unique(match_id, user_id)
);

create index if not exists idx_team_selections_match_id on team_selections (match_id);
create index if not exists idx_team_selections_user_id on team_selections (user_id);
create index if not exists idx_team_selections_created_at on team_selections (created_at desc);
