alter table team_squads
  add column if not exists tournament_id bigint;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'team_squads'
      and constraint_name = 'fk_team_squads_tournament'
  ) then
    alter table team_squads
      add constraint fk_team_squads_tournament
      foreign key (tournament_id) references tournaments (id) on delete cascade;
  end if;
end $$;

update team_squads ts
set tournament_id = t.id,
    updated_at = now()
from tournaments t
where ts.tournament_id is null
  and nullif(trim(ts.tournament), '') is not null
  and lower(trim(ts.tournament)) = lower(trim(t.name));

alter table team_squads
  drop constraint if exists team_squads_team_code_key;

drop index if exists idx_team_squads_tournament_team;

create unique index if not exists idx_team_squads_tournament_team
  on team_squads (tournament_id, team_code);

create table if not exists tournament_players (
  id bigserial primary key,
  tournament_id bigint not null,
  player_id bigint not null,
  team_code text not null,
  role text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_tournament_players_tournament
    foreign key (tournament_id) references tournaments (id) on delete cascade,
  constraint fk_tournament_players_player
    foreign key (player_id) references players (id) on delete cascade,
  unique (tournament_id, player_id)
);

create index if not exists idx_tournament_players_tournament_team
  on tournament_players (tournament_id, team_code);

create index if not exists idx_tournament_players_player
  on tournament_players (player_id);

insert into tournament_players (
  tournament_id,
  player_id,
  team_code,
  role,
  active,
  created_at,
  updated_at
)
select distinct
  ts.tournament_id,
  p.id,
  p.team_key,
  coalesce(p.role, ''),
  coalesce(p.active, true),
  now(),
  now()
from players p
join team_squads ts
  on ts.team_code = p.team_key
where ts.tournament_id is not null
on conflict (tournament_id, player_id) do update
set team_code = excluded.team_code,
    role = excluded.role,
    active = excluded.active,
    updated_at = now();
