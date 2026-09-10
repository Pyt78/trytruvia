import { getAuditLogs, getViewer } from '@/lib/api';

const PHASE_ONE = [
  ['Connect', 'AWS, Entra ID, Google Workspace, GitHub, Okta', 'Phase 1'],
  ['Monitor', 'Continuous control tests with dated evidence', 'Phase 1'],
  ['Map', 'ISO 27001, SOC 2, UAE IA v2, PDPL requirement sets', 'Phase 2'],
  ['Prove', 'Published Trust Center on your own domain', 'Phase 3']
] as const;

export default async function OverviewPage() {
  const viewer = await getViewer();
  const org = viewer?.organizations[0];
  const logs = org ? await getAuditLogs(org.id) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Workspace foundations are live. Control monitoring arrives with the first integrations.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PHASE_ONE.map(([title, description, phase]) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{phase}</p>
            <p className="mt-2 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <p className="mt-1 text-xs text-slate-500">
          Every state change is written to an append-only audit log.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {(logs?.entries ?? []).slice(0, 8).map((entry) => (
            <li key={entry.id} className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-700">{entry.action}</span>
              <span className="text-xs text-slate-400">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
          {(logs?.entries ?? []).length === 0 && (
            <li className="text-xs text-slate-400">No activity yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
