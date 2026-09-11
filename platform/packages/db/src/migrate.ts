/**
 * Minimal forward-only migration runner.
 *
 * Applies every unapplied .sql file in ../migrations in filename order, each in
 * its own transaction, recording it in `schema_migrations`. Re-running is safe.
 *
 * It connects with ADMIN_DATABASE_URL (the owner role) rather than the
 * application role, because migrations create roles and policies that the
 * restricted application role is deliberately not allowed to change.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { loadEnvFile } from './env-file.js';

loadEnvFile();

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

async function main() {
  const url = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('ADMIN_DATABASE_URL or DATABASE_URL must be set');

  const sql = postgres(url, { max: 1 });
  await sql`create table if not exists schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;

  const applied = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name)
  );
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(join(migrationsDir, file), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
  }

  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
