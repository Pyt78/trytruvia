import { getMembers, getViewer } from '@/lib/api';

export default async function SettingsPage() {
  const viewer = await getViewer();
  const org = viewer?.organizations[0];
  const members = org ? await getMembers(org.id) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Organization, data region and access.</p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Organization</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-400">Name</dt>
            <dd className="mt-0.5 font-medium">{org?.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Slug</dt>
            <dd className="mt-0.5 font-medium">{org?.slug}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Data region</dt>
            <dd className="mt-0.5 font-medium">{org?.dataRegion}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Members</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(members?.members ?? []).map((member) => (
            <li key={member.id} className="flex items-center justify-between border-t border-slate-100 pt-2">
              <span>
                <span className="font-medium">{member.name}</span>{' '}
                <span className="text-slate-400">{member.email}</span>
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-600">
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
