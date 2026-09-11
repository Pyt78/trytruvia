/**
 * The audit log: the single place where "who did what, when" is recorded.
 *
 * Auditors read this table during an assessment, so entries are append-only and
 * always carry the acting identity — a person, an agent, or the system itself.
 * Any new mutating route is expected to call `recordAudit`.
 */
import { auditLogs, withOrg, type Database } from '@truvia/db';

export type AuditEntry = {
  orgId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  actorUserId?: string;
  actorType?: 'user' | 'agent' | 'system';
  metadata?: Record<string, unknown>;
  ip?: string;
};

/**
 * Every state change in the platform lands here. Auditors read this table, so
 * writes are append-only and always carry the acting identity.
 */
export async function recordAudit(db: Database, entry: AuditEntry): Promise<void> {
  await withOrg(db, entry.orgId, async (tx) => {
    await tx.insert(auditLogs).values({
      orgId: entry.orgId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorType: entry.actorType ?? 'user',
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null
    });
  });
}
