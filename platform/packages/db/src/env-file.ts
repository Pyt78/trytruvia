/**
 * Loads platform/.env into process.env for local development.
 *
 * No dependency and no override: variables already set in the environment win,
 * so CI (which injects them directly and has no .env file) behaves exactly as
 * before, while `npm run dev:api` works without the developer remembering to
 * source the file first.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORM_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export function loadEnvFile(path = join(PLATFORM_ROOT, '.env')): void {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (key in process.env) continue;

    const raw = trimmed.slice(separator + 1).trim();
    const quoted = raw.length > 1 && (raw.startsWith('"') || raw.startsWith("'")) && raw.endsWith(raw[0]!);
    process.env[key] = quoted ? raw.slice(1, -1) : raw;
  }
}
