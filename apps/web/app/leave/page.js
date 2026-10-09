'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import { Calendar, Clock, AlertCircle, CheckCircle2, ArrowLeft, Send, Trash2 } from 'lucide-react';


export default function LeavePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [leaveData, setLeaveData] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchLeaveData = async () => {
    try {
      const res = await fetch('/api/leave/me');
      if (res.ok) {
        const json = await res.json();
        setLeaveData(json);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else fetchLeaveData();
    }
  }, [loading, user, router]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitLoading(true);

    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_date: fromDate,
          to_date: toDate,
          half_day: halfDay,
          reason: reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit leave request');
      }

      setSuccessMsg('Leave request submitted successfully for approval!');
      setFromDate('');
      setToDate('');
      setReason('');
      setHalfDay(false);
      fetchLeaveData();
    } catch (err) {
      setError(err.message || 'Failed to submit leave');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelLeave = async (leaveId) => {
    try {
      const res = await fetch(`/api/leave/${leaveId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLeaveData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !leaveData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-400">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading Leave Console...</span>
        </div>
      </main>
    );
  }

  const { balance, requests } = leaveData;

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#090d16] pb-12">
      <Header />
      <div className="max-w-6xl mx-auto p-6 lg:p-12 space-y-10">



        {/* Header & Balance Card */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Calendar className="w-8 h-8 text-emerald-400" /> Leave Application & Balances
            </h1>
            <p className="text-slate-400 text-sm mt-1">Apply for leave, track balances, and manage requests.</p>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-slate-800 flex items-center gap-6 glow-emerald">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Leave Balance ({balance.year})</p>
              <p className="text-2xl font-bold text-emerald-400">{balance.remaining} Days Remaining</p>
            </div>
            <div className="border-l border-slate-800 pl-6 text-xs text-slate-400 space-y-1">
              <p>Allotted: <span className="text-white font-semibold">{balance.allotted}</span></p>
              <p>Used: <span className="text-white font-semibold">{balance.used}</span></p>
            </div>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Apply Form */}
          <div className="lg:col-span-5 glass-card p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" /> Apply For Leave
            </h2>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">From Date</label>
                <input
                  type="date"
                  required
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-all text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">To Date</label>
                <input
                  type="date"
                  required
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-all text-sm font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="halfDayToggle"
                  checked={halfDay}
                  onChange={(e) => setHalfDay(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="halfDayToggle" className="text-sm font-medium text-slate-300">
                  Half Day Leave (0.5 day)
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Reason</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for leave request..."
                  className="w-full px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
              >
                {submitLoading ? <span>Submitting...</span> : <span>Submit Leave Request</span>}
              </button>
            </form>
          </div>

          {/* Leave Requests Table */}
          <div className="lg:col-span-7 glass-card p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" /> My Leave Requests History
            </h2>

            {requests.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No leave requests submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-extrabold uppercase rounded-md ${
                          r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                          r.status === 'rejected' ? 'bg-rose-500/20 text-rose-300' :
                          r.status === 'cancelled' ? 'bg-slate-800 text-slate-400' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {r.status}
                        </span>
                        {r.half_day && <span className="text-xs font-bold text-sky-400">(Half Day)</span>}
                      </div>
                      <p className="text-sm font-semibold text-white">{r.from_date} to {r.to_date}</p>
                      <p className="text-xs text-slate-400">"{r.reason}"</p>
                      {r.decision_note && <p className="text-xs text-indigo-400">Decision note: {r.decision_note}</p>}
                    </div>

                    {r.status === 'pending' && (
                      <button
                        onClick={() => handleCancelLeave(r.id)}
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                        title="Cancel Request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
