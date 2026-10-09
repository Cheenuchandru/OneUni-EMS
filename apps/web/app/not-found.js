import Link from 'next/link';
import Logo from '../components/Logo';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#051812] text-white p-6">
      <div className="glass-card p-8 rounded-3xl border border-emerald-900/50 text-center max-w-md space-y-6 shadow-2xl">
        <div className="flex justify-center">
          <Logo size="md" showSubtitle={false} href="/" />
        </div>
        <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-400 border border-rose-500/20 w-fit mx-auto">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-white">Page Not Found</h1>
          <p className="text-xs text-slate-300">The page or resource you requested could not be found in the OneUni EMS portal.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return to OneUni Workspace
        </Link>
      </div>
    </main>
  );
}
