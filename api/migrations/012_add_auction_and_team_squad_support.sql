alter table contests
  add column if not exists game text not null default 'Fantasy',
  add column if not exists mode text not null default 'standard',
  add column if not exists source_key text;

create unique index if not exists idx_contests_source_key on contests (source_key)
where source_key is not null;

alter table matches
  add column if not exists source_key text;

create unique index if not exists idx_matches_source_key on matches (source_key)
where source_key is not null;

alter table players
  add column if not exists display_name text,
  add column if not exists country text,
  add column if not exists team_name text,
  add column if not exists image_url text,
  add column if not exists active boolean not null default true,
  add column if not exists batting_style text,
  add column if not exists bowling_style text,
  add column if not exists base_price numeric(10, 2),
  add column if not exists source_key text;

create unique index if not exists idx_players_source_key on players (source_key)
where source_key is not null;

create table if not exists team_squads (
  id bigserial primary key,
  team_code text not null unique,
  team_name text not null,
  tournament_type text not null default 'league',
  country text not null default '',
  league text not null default '',
  tournament text not null default '',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_squads_team_code on team_squads (team_code);
create index if not exists idx_team_squads_league on team_squads (league);
create index if not exists idx_team_squads_tournament on team_squads (tournament);

create table if not exists contest_fixed_rosters (
  id bigserial primary key,
  contest_id bigint not null,
  user_id bigint not null,
  player_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_contest_fixed_rosters_contest foreign key (contest_id)
    references contests (id) on delete cascade,
  constraint fk_contest_fixed_rosters_user foreign key (user_id)
    references users (id) on delete cascade,
  unique(contest_id, user_id)
);

create index if not exists idx_contest_fixed_rosters_contest_id
  on contest_fixed_rosters (contest_id);
create index if not exists idx_contest_fixed_rosters_user_id
  on contest_fixed_rosters (user_id);
