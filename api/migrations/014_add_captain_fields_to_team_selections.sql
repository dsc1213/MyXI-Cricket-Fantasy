alter table team_selections
  add column if not exists captain_id bigint,
  add column if not exists vice_captain_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_team_selections_captain'
  ) then
    alter table team_selections
      add constraint fk_team_selections_captain
      foreign key (captain_id) references players (id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_team_selections_vice_captain'
  ) then
    alter table team_selections
      add constraint fk_team_selections_vice_captain
      foreign key (vice_captain_id) references players (id) on delete set null;
  end if;
end $$;
