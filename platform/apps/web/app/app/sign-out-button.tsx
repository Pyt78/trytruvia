'use client';

import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="mt-3 text-xs font-medium text-slate-900 underline underline-offset-4"
      onClick={async () => {
        await fetch(`${API_URL}/v1/auth/logout`, { method: 'POST', credentials: 'include' });
        router.push('/login');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
