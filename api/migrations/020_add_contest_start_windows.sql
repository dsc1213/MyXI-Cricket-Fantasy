alter table contests
  add column if not exists start_at timestamptz null,
  add column if not exists started_at timestamptz null;

create index if not exists idx_contests_start_at on contests (start_at asc);
create index if not exists idx_contests_started_at on contests (started_at asc);
