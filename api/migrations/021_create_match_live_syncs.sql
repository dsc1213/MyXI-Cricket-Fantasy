create table if not exists match_live_syncs (
  match_id bigint primary key,
  provider text not null default 'cricbuzz',
  provider_match_id text,
  live_sync_enabled boolean not null default true,
  lineup_synced_at timestamptz,
  last_score_sync_at timestamptz,
  last_provider_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_match_live_syncs_match foreign key (match_id) references matches (id) on delete cascade
);

create index if not exists idx_match_live_syncs_provider_match_id
  on match_live_syncs (provider, provider_match_id)
  where provider_match_id is not null;

create index if not exists idx_match_live_syncs_enabled
  on match_live_syncs (live_sync_enabled);
