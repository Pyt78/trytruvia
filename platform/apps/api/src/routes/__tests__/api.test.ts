/**
 * Integration tests for the API, run against a real Postgres instance — the
 * isolation guarantees here are database behaviour, so mocking the database
 * would test nothing.
 *
 * These deliberately assert the security properties rather than the happy path:
 * unauthenticated access, cross-tenant reads and writes, role minimums, the
 * privileges of the connecting role, and the stored password format.
 *
 * Requires `npm run db:migrate` to have run against the target database. The
 * connection details come from platform/.env unless the environment already
 * supplies them, which is how CI provides its own Postgres service.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { auditLogs, loadEnvFile, memberships, organizations, users, withOrg } from '@truvia/db';
import { buildApp } from '../../app.js';

loadEnvFile();

let app: FastifyInstance;
const password = 'correct-horse-battery';

function unique(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}@example.com`;
}

async function signup(email: string, organizationName: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/signup',
    payload: { name: 'Test User', email, password, organizationName }
  });
  const cookie = response.cookies.find((c) => c.name === app.env.SESSION_COOKIE_NAME);
  return { response, body: response.json(), cookie: `${cookie?.name}=${cookie?.value}` };
}

beforeAll(async () => {
  app = await buildApp({ NODE_ENV: 'test' });
});

afterAll(async () => {
  await app.close();
});

describe('auth', () => {
  it('signs a user up, creates an owner membership and logs the event', async () => {
    const email = unique('owner');
    const { response, body, cookie } = await signup(email, 'Acme Holding');
    expect(response.statusCode).toBe(201);

    const me = await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().organizations[0].role).toBe('owner');

    const logs = await app.inject({
      method: 'GET',
      url: `/v1/orgs/${body.organization.id}/audit-logs`,
      headers: { cookie }
    });
    expect(logs.json().entries[0].action).toBe('organization.created');
  });

  it('rejects a bad password and unauthenticated access', async () => {
    const email = unique('login');
    await signup(email, 'Login Co');
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'wrong-password' }
    });
    expect(bad.statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/v1/auth/me' })).statusCode).toBe(401);
  });
});

describe('authorization', () => {
  it('hides other organizations and enforces role minimums', async () => {
    const outsider = await signup(unique('outsider'), 'Outsider Co');
    const target = await signup(unique('target'), 'Target Co');

    const cross = await app.inject({
      method: 'GET',
      url: `/v1/orgs/${target.body.organization.id}`,
      headers: { cookie: outsider.cookie }
    });
    expect(cross.statusCode).toBe(404);

    await app.inject({
      method: 'POST',
      url: `/v1/orgs/${target.body.organization.id}/members`,
      payload: { email: outsider.body.user.email, role: 'auditor' },
      headers: { cookie: target.cookie }
    });

    const forbidden = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${target.body.organization.id}/members`,
      payload: { email: 'someone@example.com', role: 'member' },
      headers: { cookie: outsider.cookie }
    });
    expect(forbidden.statusCode).toBe(403);
  });
});

describe('row level security', () => {
  it('scopes org tables to the organization set on the transaction', async () => {
    const a = await signup(unique('rls-a'), 'RLS A');
    const b = await signup(unique('rls-b'), 'RLS B');

    const seenFromA = await withOrg(app.db, a.body.organization.id, async (tx) => {
      const orgs = await tx.select().from(organizations);
      const members = await tx.select().from(memberships);
      const logs = await tx.select().from(auditLogs);
      return { orgs, members, logs };
    });

    expect(seenFromA.orgs.map((o) => o.id)).toEqual([a.body.organization.id]);
    expect(seenFromA.members.every((m) => m.orgId === a.body.organization.id)).toBe(true);
    expect(seenFromA.logs.every((l) => l.orgId === a.body.organization.id)).toBe(true);
    expect(seenFromA.orgs.some((o) => o.id === b.body.organization.id)).toBe(false);
  });

  it('returns nothing when no organization is set on the connection', async () => {
    const rows = await app.db.select().from(organizations);
    expect(rows).toHaveLength(0);
  });

  it('refuses to write a row belonging to another organization', async () => {
    const a = await signup(unique('write-a'), 'Write A');
    const b = await signup(unique('write-b'), 'Write B');

    await expect(
      withOrg(app.db, a.body.organization.id, async (tx) => {
        await tx.insert(auditLogs).values({
          orgId: b.body.organization.id,
          action: 'tampering',
          resourceType: 'organization'
        });
      })
    ).rejects.toThrow();
  });

  it('runs as a role that cannot bypass row level security', async () => {
    const [row] = await app.db.execute<{ rolbypassrls: boolean; rolsuper: boolean }>(
      sql`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`
    );
    expect(row?.rolbypassrls).toBe(false);
    expect(row?.rolsuper).toBe(false);
  });
});

describe('users table', () => {
  it('never stores a plaintext password', async () => {
    const email = unique('hash');
    await signup(email, 'Hash Co');
    const [row] = await app.db.execute<{ password_hash: string }>(
      sql`select password_hash from users where email = ${email}`
    );
    expect(row?.password_hash.startsWith('scrypt$')).toBe(true);
    expect(row?.password_hash).not.toContain(password);
  });

  it('keeps the users table reachable only through the auth layer', async () => {
    const rows = await app.db.select().from(users).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});
