create table if not exists audit_logs (
  id bigserial primary key,
  performed_by bigint,
  action text not null,
  resource_type text,
  resource_id text,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  
  constraint fk_audit_logs_user foreign key (performed_by) references users (id) on delete set null
);

create index if not exists idx_audit_logs_performed_by on audit_logs (performed_by);
create index if not exists idx_audit_logs_created_at on audit_logs (created_at desc);
create index if not exists idx_audit_logs_resource on audit_logs (resource_type, resource_id);
create index if not exists idx_audit_logs_action on audit_logs (action);
