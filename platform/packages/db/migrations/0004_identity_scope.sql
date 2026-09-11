-- Identity scoped reads: a signed-in person must be able to discover which
-- organizations they belong to before any organization scope exists. This is a
-- second transaction-local setting, never a relaxation of the org policies.
create or replace function current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('truvia.user_id', true), '')::uuid
$$;

drop policy if exists memberships_isolation on memberships;
create policy memberships_isolation on memberships
  using (org_id = current_org_id() or user_id = current_user_id())
  with check (org_id = current_org_id());

drop policy if exists organizations_isolation on organizations;
create policy organizations_isolation on organizations
  using (
    id = current_org_id()
    or id in (select org_id from memberships where user_id = current_user_id())
  )
  with check (id = current_org_id());
