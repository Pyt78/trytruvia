import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>['db'];
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function createDb(connectionString: string, options: { max?: number } = {}) {
  const client = postgres(connectionString, { max: options.max ?? 10 });
  const db = drizzle(client, { schema });
  return { db, client };
}

/**
 * Runs a callback inside a transaction scoped to one organization. The org id is
 * published as a transaction-local setting that every row level security policy
 * reads, so a query that forgets its own org filter still cannot cross tenants.
 */
export async function withOrg<T>(
  db: Database,
  orgId: string,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('truvia.org_id', ${orgId}, true)`);
    return fn(tx);
  });
}

/**
 * Runs a callback scoped to one person. Used for the lookups that happen before
 * an organization is chosen: which organizations does this user belong to, and
 * what is their role in the one they are asking about.
 */
export async function withUser<T>(
  db: Database,
  userId: string,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('truvia.user_id', ${userId}, true)`);
    return fn(tx);
  });
}
