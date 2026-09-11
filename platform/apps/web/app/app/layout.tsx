/**
 * Authenticated application shell.
 *
 * The session check lives here rather than in middleware so that every page
 * under /app shares one `/me` call, and an expired session redirects before any
 * child page renders. Navigation entries for phases not yet built point at
 * placeholder pages that state which phase will fill them in.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/api';
import { SignOutButton } from './sign-out-button';

const NAV = [
  ['Overview', '/app'],
  ['Frameworks', '/app/frameworks'],
  ['Controls', '/app/controls'],
  ['Evidence', '/app/evidence'],
  ['Integrations', '/app/integrations'],
  ['Trust Center', '/app/trust-center'],
  ['Audit log', '/app/audit-log'],
  ['Settings', '/app/settings']
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  const org = viewer.organizations[0];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-xs font-bold text-white">
            T
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.03em]">{org?.name ?? 'Truvia'}</p>
            <p className="text-[11px] text-slate-400">{org?.dataRegion ?? 'me-central-1'}</p>
          </div>
        </div>
        <nav className="mt-6 space-y-0.5 text-sm">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="block rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <p className="font-medium text-slate-700">{viewer.user.name}</p>
          <p className="truncate">{viewer.user.email}</p>
          <p className="mt-1 uppercase tracking-wider text-slate-400">{org?.role}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
