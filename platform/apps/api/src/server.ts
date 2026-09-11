/**
 * Process entry point: build the app and listen. Deployment concerns
 * (port, host) live here and nowhere else.
 *
 * `loadEnvFile()` fills in anything platform/.env defines that the environment
 * does not already set, so `npm run dev:api` needs no shell preamble; it is a
 * no-op in CI and in deployed environments, which have no .env file.
 */
import { loadEnvFile } from '@truvia/db';
import { buildApp } from './app.js';

loadEnvFile();

const app = await buildApp();
await app.listen({ port: app.env.API_PORT, host: '0.0.0.0' });
