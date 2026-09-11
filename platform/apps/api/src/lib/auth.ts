/**
 * Session and membership helpers.
 *
 * Sessions are opaque random tokens sent as httpOnly cookies; only their SHA-256
 * digest is stored, so a database leak does not hand over live sessions.
 *
 * Roles are ordered (auditor < member < admin < owner) and checked with
 * `hasRole(actual, minimum)`, so a route states the least privilege it needs
 * instead of enumerating the roles it accepts.
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { memberships, sessions, users, withUser, type Database, type MemberRole } from '@truvia/db';

export const ROLE_RANK: Record<MemberRole, number> = {
  auditor: 0,
  member: 1,
  admin: 2,
  owner: 3
};

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  db: Database,
  userId: string,
  ttlHours: number
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function destroySession(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function resolveSession(db: Database, token: string) {
  const rows = await db
    .select({ userId: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMembership(db: Database, userId: string, orgId: string) {
  const rows = await withUser(db, userId, async (tx) =>
    tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
      .limit(1)
  );
  return rows[0] ?? null;
}

export function hasRole(role: MemberRole, minimum: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
