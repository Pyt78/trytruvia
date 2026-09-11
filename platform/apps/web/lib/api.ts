/**
 * Server-side client for the platform API.
 *
 * Pages render on the server and forward the incoming session cookie to the API,
 * so the browser never holds an API token and authorization is decided in one
 * place — the API. A failed or unauthorized call returns null and the caller
 * decides whether that means "redirect to login" or "render empty".
 */
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export type Viewer = {
  user: { userId: string; email: string; name: string };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    dataRegion: string;
    role: 'owner' | 'admin' | 'member' | 'auditor';
  }>;
};

export type AuditEntry = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorType: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

async function apiFetch<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { cookie: await cookieHeader() },
    cache: 'no-store'
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export function getViewer(): Promise<Viewer | null> {
  return apiFetch<Viewer>('/v1/auth/me');
}

export function getAuditLogs(orgId: string): Promise<{ entries: AuditEntry[] } | null> {
  return apiFetch<{ entries: AuditEntry[] }>(`/v1/orgs/${orgId}/audit-logs`);
}

export function getMembers(orgId: string) {
  return apiFetch<{
    members: Array<{ id: string; name: string; email: string; role: string; createdAt: string }>;
  }>(`/v1/orgs/${orgId}/members`);
}

export { API_URL };
