create table if not exists contest_scores (
  id bigserial primary key,
  contest_id bigint not null,
  match_id bigint not null,
  user_id bigint not null,
  points numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint fk_contest_scores_contest foreign key (contest_id) references contests (id) on delete cascade,
  constraint fk_contest_scores_match foreign key (match_id) references matches (id) on delete cascade,
  constraint fk_contest_scores_user foreign key (user_id) references users (id) on delete cascade,
  unique(contest_id, match_id, user_id)
);

create index if not exists idx_contest_scores_contest_id on contest_scores (contest_id);
create index if not exists idx_contest_scores_user_id on contest_scores (user_id);
create index if not exists idx_contest_scores_match_id on contest_scores (match_id);
create index if not exists idx_contest_scores_created_at on contest_scores (created_at desc);
