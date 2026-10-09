'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import PunchWidget from '../../components/PunchWidget';
import Link from 'next/link';
import { ArrowLeft, Clock, Smartphone, Laptop } from 'lucide-react';

export default function PunchPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [punches, setPunches] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(true);

  const fetchPunches = async () => {
    try {
      const res = await fetch('/api/attendance/me');
      if (res.ok) {
        const data = await res.json();
        setPunches(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchPunches();
      }
    }
  }, [loading, user, router]);

  if (loading || fetchLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-400">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 animate-spin text-sky-400" />
          <span>Loading Punch Console...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#090d16] pb-12">
      <Header />
      <div className="max-w-4xl mx-auto p-6 lg:p-12 space-y-8">



        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Punch Action Widget */}
          <div className="lg:col-span-5">
            <PunchWidget onPunchSuccess={fetchPunches} />
          </div>

          {/* Punches History */}
          <div className="lg:col-span-7 glass-card p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" /> My Attendance Log
              </h2>
              <span className="text-xs text-slate-400">{punches.length} records</span>
            </div>

            {punches.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No punch records logged yet.</p>
            ) : (
              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {punches.map((p) => (
                  <div key={p.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          p.punch_type === 'in' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          PUNCH {p.punch_type}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{p.day}</span>
                        <span className="text-xs font-semibold text-sky-400 uppercase">({p.work_mode})</span>
                      </div>
                      <div className="text-xs text-slate-300 font-mono space-x-3">
                        <span>Claimed: {new Date(p.claimed_at).toLocaleTimeString()}</span>
                        <span className="text-slate-500">|</span>
                        <span>Server: {new Date(p.server_at).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <div className="text-xs font-bold text-slate-200 flex items-center justify-end gap-1.5">
                        {p.device_type === 'mobile' ? <Smartphone className="w-3.5 h-3.5 text-amber-400" /> : <Laptop className="w-3.5 h-3.5 text-sky-400" />}
                        <span className="capitalize">{p.device_type}</span> ({p.os_name})
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Gap: <span className={p.gap_minutes > 10 ? 'text-rose-400 font-bold' : 'text-slate-300'}>{p.gap_minutes}m</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
