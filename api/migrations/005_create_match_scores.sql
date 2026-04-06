create table if not exists match_scores (
  id bigserial primary key,
  match_id bigint not null,
  tournament_id bigint not null,
  player_stats jsonb not null default '[]'::jsonb,
  uploaded_by bigint,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint fk_match_scores_match foreign key (match_id) references matches (id) on delete cascade,
  constraint fk_match_scores_tournament foreign key (tournament_id) references tournaments (id) on delete cascade,
  constraint fk_match_scores_user foreign key (uploaded_by) references users (id) on delete set null
);

create index if not exists idx_match_scores_match_id on match_scores (match_id);
create index if not exists idx_match_scores_tournament_id on match_scores (tournament_id);
create index if not exists idx_match_scores_active on match_scores (active);
create index if not exists idx_match_scores_created_at on match_scores (created_at desc);
