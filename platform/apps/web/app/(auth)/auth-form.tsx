'use client';

/**
 * Shared login/signup form.
 *
 * This is a client component that posts directly to the API with
 * `credentials: 'include'`, so the session cookie is set by the API on its own
 * origin. After success it calls `router.refresh()` to re-run the server
 * components, which then see the new session.
 */
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ERRORS: Record<string, string> = {
  invalid_credentials: 'That email and password combination is not valid.',
  email_taken: 'An account already exists for that email.',
  invalid_body: 'Check the form — passwords must be at least 12 characters.'
};

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload =
      mode === 'signup'
        ? {
            name: String(form.get('name')),
            email: String(form.get('email')),
            password: String(form.get('password')),
            organizationName: String(form.get('organizationName'))
          }
        : { email: String(form.get('email')), password: String(form.get('password')) };

    const response = await fetch(`${API_URL}/v1/auth/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(ERRORS[body.error ?? ''] ?? 'Something went wrong. Try again.');
      setPending(false);
      return;
    }

    router.push('/app');
    router.refresh();
  }

  const field =
    'min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none transition focus:border-slate-950';

  return (
    <form className="mt-5 space-y-3" onSubmit={onSubmit}>
      {mode === 'signup' && (
        <>
          <input required name="name" placeholder="Full name" className={field} />
          <input required name="organizationName" placeholder="Organization" className={field} />
        </>
      )}
      <input required type="email" name="email" placeholder="Work email" className={field} />
      <input
        required
        type="password"
        name="password"
        minLength={mode === 'signup' ? 12 : 1}
        placeholder="Password"
        className={field}
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-xl bg-slate-950 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? 'Working…' : mode === 'signup' ? 'Create workspace' : 'Sign in'}
      </button>
      <p className="pt-1 text-center text-xs text-slate-500">
        {mode === 'signup' ? (
          <>
            Already have a workspace?{' '}
            <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Truvia?{' '}
            <Link href="/signup" className="font-medium text-slate-900 underline underline-offset-4">
              Create a workspace
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
