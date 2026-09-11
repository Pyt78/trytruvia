-- Base tables. Identity (users, sessions) is global; organizations, memberships
-- and audit_logs are tenant data and get row level security in 0002.
-- Audit rows record an actor_type as well as a user, because agents and
-- scheduled jobs will write here too from Phase 1 onwards.
create extension if not exists "pgcrypto";

do $$ begin
  create type member_role as enum ('owner', 'admin', 'member', 'auditor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type actor_type as enum ('user', 'agent', 'system');
exception when duplicate_object then null; end $$;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  data_region text not null default 'me-central-1',
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now()
);

create unique index if not exists memberships_org_user_idx on memberships (org_id, user_id);
create index if not exists memberships_user_idx on memberships (user_id);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_idx on sessions (user_id);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations (id) on delete cascade,
  actor_type actor_type not null default 'user',
  actor_user_id uuid references users (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_created_idx on audit_logs (org_id, created_at desc);
