'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import { FileText, Eye, Edit3, Send, CheckCircle2, AlertCircle, ArrowLeft, Lock } from 'lucide-react';


export default function EODPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [eodBody, setEodBody] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [eodList, setEodList] = useState([]);
  const [todayReport, setTodayReport] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchEODData = async () => {
    try {
      // 1. Fetch template default
      const tmplRes = await fetch('/api/eod/template/default');
      if (tmplRes.ok) {
        const tmplData = await tmplRes.json();
        setEodBody(tmplData.body_md);
      }

      // 2. Fetch user's EOD history
      const listRes = await fetch('/api/eod/me');
      if (listRes.ok) {
        const listData = await listRes.json();
        setEodList(listData);

        const todayStr = new Date().toISOString().slice(0, 10);
        const todayR = listData.find((r) => r.date === todayStr);
        if (todayR) {
          setTodayReport(todayR);
          setEodBody(todayR.body_md);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else fetchEODData();
    }
  }, [loading, user, router]);

  const handleSubmitEOD = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitLoading(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let res;
      if (todayReport) {
        // Edit existing
        res = await fetch(`/api/eod/${todayReport.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body_md: eodBody }),
        });
      } else {
        // Submit new
        res = await fetch('/api/eod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: todayStr, body_md: eodBody }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to submit EOD report');
      }

      setSuccessMsg(todayReport ? 'EOD report updated successfully!' : 'EOD report submitted successfully!');
      fetchEODData();
    } catch (err) {
      setError(err.message || 'Failed to save EOD report');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-400">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading EOD Console...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#090d16] pb-12">
      <Header />
      <div className="max-w-6xl mx-auto p-3 sm:p-6 lg:p-12 space-y-6 sm:space-y-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 sm:gap-3">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 shrink-0" /> End-Of-Day (EOD) Markdown Reports
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Pre-filled from Admin markdown templates. Locks at 23:59 IST.</p>
          </div>

          {todayReport?.locked ? (
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" /> Report Locked (Midnight Passed)
            </span>
          ) : (
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> {todayReport ? 'Editing Today Report' : 'Draft Active'}
            </span>
          )}
        </div>

        {/* Main Editor & History Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Markdown Editor */}
          <div className="lg:col-span-7 glass-card p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400 shrink-0" /> Today's EOD Markdown Editor
              </h2>

              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-colors shrink-0"
              >
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {previewMode ? 'Edit Raw' : 'Preview'}
              </button>
            </div>

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

            <form onSubmit={handleSubmitEOD} className="space-y-4">
              {previewMode ? (
                <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 min-h-[350px] prose prose-invert max-w-none text-slate-200 text-sm whitespace-pre-wrap font-mono">
                  {eodBody}
                </div>
              ) : (
                <textarea
                  rows={14}
                  required
                  disabled={todayReport?.locked}
                  value={eodBody}
                  onChange={(e) => setEodBody(e.target.value)}
                  className="w-full p-4 bg-slate-900/90 border border-slate-800 rounded-2xl text-white font-mono text-sm focus:outline-none focus:border-amber-500 transition-all disabled:opacity-50"
                />
              )}

              {!todayReport?.locked && (
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {submitLoading ? (
                    <span>Saving Report...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{todayReport ? 'UPDATE EOD REPORT' : 'SUBMIT EOD REPORT'}</span>
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          {/* History Column */}
          <div className="lg:col-span-5 glass-card p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" /> Submitted EOD History
            </h2>

            {eodList.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No EOD reports submitted yet.</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {eodList.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-400">{r.date}</span>
                      <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${r.locked ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {r.locked ? 'Locked' : 'Editable'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono line-clamp-3 whitespace-pre-wrap">{r.body_md}</p>
                    <p className="text-[11px] text-slate-500 font-mono text-right">Submitted: {new Date(r.submitted_at).toLocaleTimeString()}</p>
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
