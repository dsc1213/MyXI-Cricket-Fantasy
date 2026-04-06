create table if not exists contest_joins (
  id bigserial primary key,
  contest_id bigint not null,
  user_id bigint not null,
  joined_at timestamptz not null default now(),
  
  constraint fk_contest_joins_contest foreign key (contest_id) references contests (id) on delete cascade,
  constraint fk_contest_joins_user foreign key (user_id) references users (id) on delete cascade,
  unique(contest_id, user_id)
);

create index if not exists idx_contest_joins_contest_id on contest_joins (contest_id);
create index if not exists idx_contest_joins_user_id on contest_joins (user_id);
create index if not exists idx_contest_joins_joined_at on contest_joins (joined_at desc);
