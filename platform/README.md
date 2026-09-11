# Truvia platform

Phase 0 foundations for the Truvia product: an authenticated multi-tenant application
shell with organizations, roles, an append-only audit log, tenant isolation enforced in
Postgres, and an infrastructure baseline for AWS `me-central-1`.

The marketing site and public Trust Center demo still live at the repository root and
deploy independently through GitHub Pages; nothing here changes that.

## Layout

```
platform/
  apps/api     Fastify API — auth, organizations, roles, audit log
  apps/web     Next.js App Router application shell
  packages/db  Drizzle schema, SQL migrations, row level security policies
  infra/terraform  AWS me-central-1 baseline (VPC, KMS, evidence bucket, RDS)
```

## Local development

```bash
cd platform
docker compose up -d postgres
cp .env.example .env
npm install
npm run db:migrate          # applies schema + RLS policies, creates the truvia_app role
npm run dev:api             # http://localhost:4000
npm run dev:web             # http://localhost:3001
```

Sign up at http://localhost:3001/signup — the first user becomes the owner of a new
organization and the signup is written to the audit log.

## Checks

```bash
npm run typecheck
npm run lint
npm run test                # requires Postgres and a completed migration run
npm run build
```

## Design notes

`docs/architecture.md` explains the tenancy model, the request lifecycle, the
conventions to follow when adding tables or routes, and the known gaps going
into Phase 1. Read it before changing anything under `packages/db`.

## Tenant isolation

The API connects as `truvia_app`, a role that is neither a superuser nor
`BYPASSRLS`. Every organization-scoped table has `FORCE ROW LEVEL SECURITY` with a
policy comparing `org_id` to `current_setting('truvia.org_id')`, and all org-scoped
queries run inside `withOrg()`, which sets that value transaction-locally. A query
that forgets its own `where org_id = ...` clause returns nothing rather than another
tenant's rows; the test suite asserts this, including that a cross-tenant insert fails.
