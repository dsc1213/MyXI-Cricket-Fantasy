create table if not exists players (
  id bigserial primary key,
  first_name text not null,
  last_name text not null,
  role text not null,
  team_key text not null,
  player_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_players_team_key on players (team_key);
create index if not exists idx_players_player_id on players (player_id);
create index if not exists idx_players_role on players (role);
