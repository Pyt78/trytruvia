export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-xs font-bold text-white">
            T
          </span>
          <span className="text-sm font-semibold tracking-[-0.03em]">TRUVIA</span>
        </div>
        {children}
      </div>
    </div>
  );
}
