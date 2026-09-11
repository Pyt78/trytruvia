-- Creating a tenant is the one operation that cannot run under a tenant scope:
-- there is no organization to scope to yet. It goes through a single security
-- definer entry point instead of relaxing the isolation policies.
create or replace function provision_organization(
  p_name text,
  p_slug text,
  p_owner_user_id uuid
) returns organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org organizations;
begin
  insert into organizations (name, slug) values (p_name, p_slug) returning * into v_org;
  insert into memberships (org_id, user_id, role) values (v_org.id, p_owner_user_id, 'owner');
  return v_org;
end;
$$;

revoke all on function provision_organization(text, text, uuid) from public;
grant execute on function provision_organization(text, text, uuid) to truvia_app;
