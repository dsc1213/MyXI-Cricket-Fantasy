alter table team_selections
  add column if not exists contest_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_team_selections_contest'
  ) then
    alter table team_selections
      add constraint fk_team_selections_contest
      foreign key (contest_id) references contests (id) on delete cascade;
  end if;
end $$;

create index if not exists idx_team_selections_contest_id
  on team_selections (contest_id);

create unique index if not exists idx_team_selections_contest_match_user
  on team_selections (contest_id, match_id, user_id)
  where contest_id is not null;

create table if not exists player_match_scores (
  id bigserial primary key,
  tournament_id bigint not null,
  match_id bigint not null,
  player_id bigint not null,
  raw_stats jsonb not null default '{}'::jsonb,
  runs integer not null default 0,
  wickets integer not null default 0,
  catches integer not null default 0,
  fours integer not null default 0,
  sixes integer not null default 0,
  maidens integer not null default 0,
  wides integer not null default 0,
  stumpings integer not null default 0,
  runout_direct integer not null default 0,
  runout_indirect integer not null default 0,
  dismissed boolean not null default false,
  fantasy_points numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_player_match_scores_tournament foreign key (tournament_id)
    references tournaments (id) on delete cascade,
  constraint fk_player_match_scores_match foreign key (match_id)
    references matches (id) on delete cascade,
  constraint fk_player_match_scores_player foreign key (player_id)
    references players (id) on delete cascade,
  unique (tournament_id, match_id, player_id)
);

create index if not exists idx_player_match_scores_tournament_match
  on player_match_scores (tournament_id, match_id);
create index if not exists idx_player_match_scores_match_id
  on player_match_scores (match_id);
create index if not exists idx_player_match_scores_player_id
  on player_match_scores (player_id);

create table if not exists contest_match_players (
  id bigserial primary key,
  tournament_id bigint not null,
  contest_id bigint not null,
  match_id bigint not null,
  user_id bigint not null,
  player_id bigint not null,
  source text not null default 'selection',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_contest_match_players_tournament foreign key (tournament_id)
    references tournaments (id) on delete cascade,
  constraint fk_contest_match_players_contest foreign key (contest_id)
    references contests (id) on delete cascade,
  constraint fk_contest_match_players_match foreign key (match_id)
    references matches (id) on delete cascade,
  constraint fk_contest_match_players_user foreign key (user_id)
    references users (id) on delete cascade,
  constraint fk_contest_match_players_player foreign key (player_id)
    references players (id) on delete cascade,
  unique (contest_id, match_id, user_id, player_id)
);

create index if not exists idx_contest_match_players_contest_match
  on contest_match_players (contest_id, match_id);
create index if not exists idx_contest_match_players_user_match
  on contest_match_players (user_id, match_id);
