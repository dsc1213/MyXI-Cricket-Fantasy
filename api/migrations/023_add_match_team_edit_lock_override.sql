alter table matches
  add column if not exists team_edit_lock_override text null;

alter table matches
  drop constraint if exists chk_matches_team_edit_lock_override;

alter table matches
  add constraint chk_matches_team_edit_lock_override
  check (
    team_edit_lock_override is null
    or team_edit_lock_override in ('force_open', 'force_locked')
  );
