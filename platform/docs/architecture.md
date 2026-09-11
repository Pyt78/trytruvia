# Phase 0 architecture

What exists today, why it is shaped this way, and where the next phase plugs in.
Written for whoever picks this up next — human or agent.

## What Phase 0 is

Phase 0 is the foundation everything else in the product plan sits on: an
authenticated, multi-tenant application shell with organizations, roles, an
audit log, tenant isolation the database enforces, and an infrastructure
baseline in the UAE region. There is deliberately no compliance functionality
yet — no integrations, no controls, no evidence collection. Those are Phase 1+.

The static marketing site (`index.html`) and the public Trust Center demo
(`trust/index.html`) at the repository root are unrelated to this code. They are
served by GitHub Pages directly from `main` and keep working exactly as before.

## Shape

```
Browser ──► Next.js (apps/web, :3001)  ──► Fastify API (apps/api, :4000) ──► Postgres
            server components forward       sessions, roles, audit log        RLS per org
            the session cookie
```

- **`apps/web`** renders on the server and never talks to Postgres. It forwards
  the incoming session cookie to the API, so authorization is decided in exactly
  one place.
- **`apps/api`** owns authentication, authorization and the audit log.
- **`packages/db`** owns the schema, the SQL migrations and the two scoping
  helpers (`withOrg`, `withUser`).
- **`infra/terraform`** describes the AWS `me-central-1` footprint. Not applied.

## Tenant isolation

This is the part worth understanding before changing anything.

A compliance product holds its customers' most sensitive posture data, so
"tenant A can never see tenant B" cannot rest on every developer remembering a
`where org_id = ...` clause. It is enforced in Postgres:

1. The API connects as `truvia_app`, a role that is **not** a superuser and is
   **`NOBYPASSRLS`**, so row level security always applies to it.
2. Every organization-scoped table (`organizations`, `memberships`,
   `audit_logs`) has `FORCE ROW LEVEL SECURITY` with a policy comparing `org_id`
   against `current_setting('truvia.org_id')`.
3. That setting is written transaction-locally by `withOrg(db, orgId, fn)`.

The consequence: a query outside `withOrg` returns **zero rows** rather than
another tenant's rows. Forgetting the scope fails closed.

Two operations genuinely cannot run inside an organization scope, and each has a
narrow, explicit escape hatch rather than a weakened policy:

| Operation | Problem | Mechanism |
| --- | --- | --- |
| "Which organizations do I belong to?" | No organization chosen yet | `withUser` sets `truvia.user_id`; `memberships` is readable by `org_id = current_org_id() OR user_id = current_user_id()` |
| "Create a new organization" | The organization does not exist yet | `provision_organization(...)`, a `security definer` function that creates the org and its owner membership atomically |

Every `WITH CHECK` clause stays strictly `org_id = current_org_id()`, so those
read-side allowances never widen what can be written.

`users` and `sessions` are global identity tables with no RLS: they have no
organization, are reached only through the auth layer, and never return another
person's row to a request.

## Request lifecycle

1. `onRequest` in `app.ts` reads the session cookie, hashes it, looks up a
   non-expired session, and sets `request.user` (or `null`).
2. An organization route calls `requireMember(app, request, reply, minimumRole)`,
   which resolves the caller's membership through `withUser` and answers
   `401` (no session), `404` (not a member — an outsider cannot tell whether the
   organization exists) or `403` (member, but below the required role).
3. The handler runs its queries inside `withOrg`, so the database re-checks the
   same boundary independently of the handler's own filters.
4. Any mutation calls `recordAudit`, which appends to `audit_logs` under the
   same organization scope.

## Conventions to keep

- **New org-scoped table:** add `org_id`, enable and force RLS, add a policy
  matching `current_org_id()`, and grant the new table to `truvia_app`
  (the default privileges in migration `0002` cover tables created afterwards).
- **New mutation:** call `recordAudit`. If it is not in the audit log, an auditor
  cannot see it happened.
- **New route:** state the least privilege it needs via `requireMember`.
- **Schema change:** write a new numbered SQL migration. `packages/db/src/schema.ts`
  is the TypeScript view of the schema; it is never pushed to the database.
- **Anything reached before an org is chosen:** use `withUser`, not a broader
  policy.

## Verification

`npm run test` runs against a real Postgres instance, because these guarantees
are database behaviour. The suite asserts that an unscoped query returns
nothing, a cross-tenant insert is rejected, cross-tenant reads 404, an
under-privileged member gets 403, the connecting role is neither superuser nor
`BYPASSRLS`, and stored passwords are scrypt hashes.

## Known gaps entering Phase 1

- Terraform has never been applied; no AWS account or credentials are wired up,
  and there is no state backend yet.
- No SSO/SAML, no MFA, no password reset, no invitation emails — signup creates
  the org, and members must already have an account to be added.
- No rate limiting on the auth routes.
- Sessions are opaque cookies with a fixed TTL and no refresh or revoke-all.
- The app pages for frameworks, controls, evidence, integrations and the Trust
  Center are placeholders naming the phase that will implement them.
