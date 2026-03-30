alter table tournaments
  add column if not exists tournament_type text not null default 'international',
  add column if not exists country text not null default '',
  add column if not exists league text not null default '',
  add column if not exists selected_teams jsonb not null default '[]'::jsonb,
  add column if not exists source text not null default 'manual';

create index if not exists idx_tournaments_tournament_type on tournaments (tournament_type);
create index if not exists idx_tournaments_country on tournaments (country);
create index if not exists idx_tournaments_league on tournaments (league);
