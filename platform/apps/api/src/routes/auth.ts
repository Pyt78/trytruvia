import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { memberships, organizations, users, withUser, type Organization } from '@truvia/db';
import { createSession, destroySession } from '../lib/auth.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { recordAudit } from '../lib/audit.js';
import { slugify } from '../lib/slug.js';

const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(12).max(200),
  organizationName: z.string().min(2).max(120)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: app.env.NODE_ENV === 'production',
    path: '/'
  };

  app.post('/signup', async (request, reply) => {
    const body = signupSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'invalid_body', issues: body.error.issues });

    const existing = await app.db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
    if (existing.length > 0) return reply.status(409).send({ error: 'email_taken' });

    const passwordHash = await hashPassword(body.data.password);
    const result = await app.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ email: body.data.email, name: body.data.name, passwordHash })
        .returning();
      if (!user) throw new Error('signup_failed');
      const slug = `${slugify(body.data.organizationName)}-${Math.random().toString(36).slice(2, 8)}`;
      const [org] = await tx.execute<Organization>(
        sql`select * from provision_organization(${body.data.organizationName}, ${slug}, ${user.id})`
      );
      if (!org) throw new Error('signup_failed');
      return { user, org };
    });

    await recordAudit(app.db, {
      orgId: result.org.id,
      actorUserId: result.user.id,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: result.org.id,
      metadata: { name: result.org.name },
      ip: request.ip
    });

    const session = await createSession(app.db, result.user.id, app.env.SESSION_TTL_HOURS);
    reply.setCookie(app.env.SESSION_COOKIE_NAME, session.token, {
      ...cookieOptions,
      expires: session.expiresAt
    });
    return reply.status(201).send({
      user: { id: result.user.id, email: result.user.email, name: result.user.name },
      organization: { id: result.org.id, name: result.org.name, slug: result.org.slug }
    });
  });

  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.status(400).send({ error: 'invalid_body' });

    const [user] = await app.db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
    if (!user || !(await verifyPassword(body.data.password, user.passwordHash))) {
      return reply.status(401).send({ error: 'invalid_credentials' });
    }

    const session = await createSession(app.db, user.id, app.env.SESSION_TTL_HOURS);
    reply.setCookie(app.env.SESSION_COOKIE_NAME, session.token, {
      ...cookieOptions,
      expires: session.expiresAt
    });
    return { user: { id: user.id, email: user.email, name: user.name } };
  });

  app.post('/logout', async (request, reply) => {
    const token = request.cookies[app.env.SESSION_COOKIE_NAME];
    if (token) await destroySession(app.db, token);
    reply.clearCookie(app.env.SESSION_COOKIE_NAME, cookieOptions);
    return { ok: true };
  });

  app.get('/me', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'unauthenticated' });
    const viewer = request.user;
    const orgs = await withUser(app.db, viewer.userId, async (tx) =>
      tx.select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        dataRegion: organizations.dataRegion,
        role: memberships.role
      })
        .from(memberships)
        .innerJoin(organizations, eq(organizations.id, memberships.orgId))
        .where(eq(memberships.userId, viewer.userId))
    );
    return { user: viewer, organizations: orgs };
  });
}
