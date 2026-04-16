drop index if exists team_selections_match_id_user_id_key;

alter table team_selections
  drop constraint if exists team_selections_match_id_user_id_key;
