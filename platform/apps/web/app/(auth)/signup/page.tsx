import { AuthForm } from '@/app/(auth)/auth-form';

export default function SignupPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold tracking-[-0.03em]">Create your workspace</h1>
      <p className="mt-1 text-sm text-slate-500">Data stays in the UAE region by default.</p>
      <AuthForm mode="signup" />
    </div>
  );
}
