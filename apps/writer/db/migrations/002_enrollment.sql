-- Self-service enrollment. A project signs up in the dashboard; its owner's Umami
-- account and team are created at once. In open mode the request is approved
-- immediately; in approval mode an operator approves or rejects it.
create table if not exists scf_api.enrollment (
  enrollment_id  uuid primary key default gen_random_uuid(),
  project_name   text not null check (length(project_name) between 2 and 80),
  domains        text[] not null,
  stellar_link   text not null,
  contact        text not null,
  umami_user_id  uuid not null,
  umami_team_id  uuid not null unique,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  tenant_id      uuid references scf_api.tenant (tenant_id) on delete set null,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     text,
  note           text
);

create index if not exists enrollment_status_created on scf_api.enrollment (status, created_at desc);
