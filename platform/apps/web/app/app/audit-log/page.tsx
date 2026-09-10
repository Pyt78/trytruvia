import { getAuditLogs, getViewer } from '@/lib/api';

export default async function AuditLogPage() {
  const viewer = await getViewer();
  const org = viewer?.organizations[0];
  const logs = org ? await getAuditLogs(org.id) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Append-only record of every action taken by a person, an agent or the system.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Resource</th>
              <th className="px-5 py-3 font-medium">Actor</th>
              <th className="px-5 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(logs?.entries ?? []).map((entry) => (
              <tr key={entry.id}>
                <td className="px-5 py-3 font-medium">{entry.action}</td>
                <td className="px-5 py-3 text-slate-500">{entry.resourceType}</td>
                <td className="px-5 py-3 text-slate-500">{entry.actorType}</td>
                <td className="px-5 py-3 text-slate-400">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(logs?.entries ?? []).length === 0 && (
          <p className="px-5 py-6 text-sm text-slate-400">No entries yet.</p>
        )}
      </div>
    </div>
  );
}
