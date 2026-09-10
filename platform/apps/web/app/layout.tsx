import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Truvia — Agentic Trust Platform',
  description: 'Continuous compliance, risk and AI governance for the GCC.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-slate-950 antialiased">{children}</body>
    </html>
  );
}
