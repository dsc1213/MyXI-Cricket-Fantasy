create table if not exists match_lineups (
  id bigserial primary key,
  tournament_id bigint not null,
  match_id bigint not null,
  team_code text not null,
  squad jsonb not null default '[]'::jsonb,
  playing_xi jsonb not null default '[]'::jsonb,
  bench jsonb not null default '[]'::jsonb,
  captain text,
  vice_captain text,
  source text not null default 'manual-xi',
  updated_by text not null default 'admin',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_match_lineups_tournament foreign key (tournament_id) references tournaments (id) on delete cascade,
  constraint fk_match_lineups_match foreign key (match_id) references matches (id) on delete cascade,
  constraint uq_match_lineups_match_team unique (tournament_id, match_id, team_code)
);

create index if not exists idx_match_lineups_tournament_match
  on match_lineups (tournament_id, match_id);

create index if not exists idx_match_lineups_team_code
  on match_lineups (team_code);
