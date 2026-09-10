-- Application role: never a superuser, never bypasses row level security.
do $$ begin
  create role truvia_app login password 'truvia';
exception when duplicate_object then null; end $$;

alter role truvia_app nobypassrls;

grant usage on schema public to truvia_app;
grant select, insert, update, delete on all tables in schema public to truvia_app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to truvia_app;

-- Current organization is a transaction-local setting written by withOrg().
create or replace function current_org_id() returns uuid
language sql stable as $$
  select nullif(current_setting('truvia.org_id', true), '')::uuid
$$;

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table audit_logs enable row level security;

alter table organizations force row level security;
alter table memberships force row level security;
alter table audit_logs force row level security;

drop policy if exists organizations_isolation on organizations;
create policy organizations_isolation on organizations
  using (id = current_org_id())
  with check (id = current_org_id());

drop policy if exists memberships_isolation on memberships;
create policy memberships_isolation on memberships
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

drop policy if exists audit_logs_isolation on audit_logs;
create policy audit_logs_isolation on audit_logs
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- users and sessions are global identity tables reached only through the auth
-- layer, which resolves membership before any org scoped query runs.
