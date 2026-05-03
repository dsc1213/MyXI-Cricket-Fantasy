alter table player_match_scores
  add column if not exists bowled_lbw integer not null default 0;
