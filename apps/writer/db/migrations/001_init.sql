-- SCF Analytics: API metrics schema. Lives beside Umami's tables in the same
-- database, in its own `scf_api` schema (not `scf`: a schema named after the DB user would capture Umami's unqualified tables).

create table if not exists scf_api.tenant (
  tenant_id     uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 1 and 200),
  umami_team_id uuid,
  status        text not null default 'active' check (status in ('active', 'suspended')),
  created_at    timestamptz not null default now()
);

-- Write keys tenant apps send with their OpenTelemetry export. Only hashes are stored.
create table if not exists scf_api.ingest_key (
  key_hash   text primary key,
  tenant_id  uuid not null references scf_api.tenant (tenant_id) on delete cascade,
  label      text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Read keys for the metrics API. A null tenant_id means operator (global) scope.
create table if not exists scf_api.api_key (
  api_key_id   uuid primary key default gen_random_uuid(),
  key_hash     text not null unique,
  tenant_id    uuid references scf_api.tenant (tenant_id) on delete cascade,
  label        text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  revoked_at   timestamptz,
  last_used_at timestamptz
);

-- One row per tenant, service, route, method, status and minute. Latency is kept
-- as counts on fixed bucket bounds (see apps/writer/src/histogram.ts).
create table if not exists scf_api.api_metric_minute (
  tenant_id       uuid not null references scf_api.tenant (tenant_id) on delete cascade,
  service_name    text not null,
  route           text not null,
  method          text not null,
  status_code     integer not null,
  source          text not null check (source in ('metrics', 'spans')),
  bucket_start    timestamptz not null,
  request_count   bigint not null,
  duration_sum_ms double precision not null,
  bucket_counts   bigint[] not null,
  primary key (tenant_id, service_name, route, method, status_code, source, bucket_start)
);

create index if not exists api_metric_minute_tenant_time on scf_api.api_metric_minute (tenant_id, bucket_start);
create index if not exists api_metric_minute_time on scf_api.api_metric_minute (bucket_start);

-- Element-wise sum of two bucket arrays, and an aggregate built on it.
create or replace function scf_api.array_add(a bigint[], b bigint[]) returns bigint[]
language sql immutable parallel safe as $$
  select coalesce(array_agg(coalesce(x, 0) + coalesce(y, 0) order by i), '{}'::bigint[])
  from unnest(a, b) with ordinality as t(x, y, i)
$$;

create or replace aggregate scf_api.array_sum(bigint[]) (
  sfunc = scf_api.array_add,
  stype = bigint[]
);
