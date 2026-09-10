import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(4000),
  SESSION_COOKIE_NAME: z.string().default('truvia_session'),
  SESSION_TTL_HOURS: z.coerce.number().default(168),
  WEB_ORIGIN: z.string().default('http://localhost:3001'),
  NODE_ENV: z.string().default('development')
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  return parsed.data;
}
