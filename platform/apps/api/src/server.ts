/**
 * Process entry point: build the app and listen. Deployment concerns
 * (port, host) live here and nowhere else.
 */
import { buildApp } from './app.js';

const app = await buildApp();
await app.listen({ port: app.env.API_PORT, host: '0.0.0.0' });
