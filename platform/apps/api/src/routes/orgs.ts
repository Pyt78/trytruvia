import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  auditLogs,
  memberships,
  organizations,
  users,
  withOrg,
  type MemberRole
} from '@truvia/db';
import { getMembership, hasRole } from '../lib/auth.js';
import { recordAudit } from '../lib/audit.js';

const paramsSchema = z.object({ orgId: z.string().uuid() });

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'auditor'])
});

async function requireMember(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  minimum: MemberRole
) {
  if (!request.user) {
    reply.status(401).send({ error: 'unauthenticated' });
    return null;
  }
  const params = paramsSchema.safeParse(request.params);
  if (!params.success) {
    reply.status(400).send({ error: 'invalid_org_id' });
    return null;
  }
  const membership = await getMembership(app.db, request.user.userId, params.data.orgId);
  if (!membership) {
    reply.status(404).send({ error: 'not_found' });
    return null;
  }
  if (!hasRole(membership.role, minimum)) {
    reply.status(403).send({ error: 'forbidden', required: minimum });
    return null;
  }
  return { orgId: params.data.orgId, membership, user: request.user };
}

export async function registerOrgRoutes(app: FastifyInstance): Promise<void> {
  app.get('/:orgId', async (request, reply) => {
    const ctx = await requireMember(app, request, reply, 'auditor');
    if (!ctx) return;
    const org = await withOrg(app.db, ctx.orgId, async (tx) => {
      const [row] = await tx.select().from(organizations).where(eq(organizations.id, ctx.orgId)).limit(1);
      return row ?? null;
    });
    if (!org) return reply.status(404).send({ error: 'not_found' });
    return { organization: org, role: ctx.membership.role };
  });

  app.get('/:orgId/members', async (request, reply) => {
    const ctx = await requireMember(app, request, reply, 'member');
    if (!ctx) return;
    const rows = await withOrg(app.db, ctx.orgId, async (tx) =>
      tx
        .select({
          id: memberships.id,
          role: memberships.role,
          userId: users.id,
          email: users.email,
          name: users.name,
          createdAt: memberships.createdAt
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.orgId, ctx.orgId))
    );
    return { members: rows };
  });

  app.post('/:orgId/members', async (request, reply) => {
    const ctx = await requireMember(app, request, reply, 'admin');
    if (!ctx) return;
    const body = addMemberSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'invalid_body' });

    const [user] = await app.db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
    if (!user) return reply.status(404).send({ error: 'user_not_found' });

    const existing = await getMembership(app.db, user.id, ctx.orgId);
    if (existing) return reply.status(409).send({ error: 'already_member' });

    await withOrg(app.db, ctx.orgId, async (tx) => {
      await tx.insert(memberships).values({ orgId: ctx.orgId, userId: user.id, role: body.data.role });
    });

    await recordAudit(app.db, {
      orgId: ctx.orgId,
      actorUserId: ctx.user.userId,
      action: 'member.added',
      resourceType: 'membership',
      resourceId: user.id,
      metadata: { email: user.email, role: body.data.role },
      ip: request.ip
    });

    return reply.status(201).send({ ok: true });
  });

  app.get('/:orgId/audit-logs', async (request, reply) => {
    const ctx = await requireMember(app, request, reply, 'auditor');
    if (!ctx) return;
    const rows = await withOrg(app.db, ctx.orgId, async (tx) =>
      tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.orgId, ctx.orgId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(100)
    );
    return { entries: rows };
  });
}
