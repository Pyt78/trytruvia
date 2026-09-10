import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { createDb, type Database } from '@truvia/db';
import { loadEnv, type Env } from './lib/env.js';
import { resolveSession } from './lib/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerOrgRoutes } from './routes/orgs.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: { userId: string; email: string; name: string } | null;
  }
  interface FastifyInstance {
    db: Database;
    env: Env;
  }
}

export async function buildApp(overrides: Partial<Env> = {}): Promise<FastifyInstance> {
  const env = { ...loadEnv(), ...overrides };
  const { db, client } = createDb(env.DATABASE_URL);

  const app = Fastify({ logger: env.NODE_ENV !== 'test' });
  app.decorate('db', db);
  app.decorate('env', env);
  app.decorateRequest('user', null);

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[env.SESSION_COOKIE_NAME];
    request.user = token ? await resolveSession(db, token) : null;
  });

  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/readyz', async (_request, reply) => {
    try {
      await client`select 1`;
      return { status: 'ready', region: process.env.AWS_REGION ?? 'local' };
    } catch {
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  await app.register(registerAuthRoutes, { prefix: '/v1/auth' });
  await app.register(registerOrgRoutes, { prefix: '/v1/orgs' });

  app.addHook('onClose', async () => {
    await client.end({ timeout: 5 });
  });

  return app;
}
