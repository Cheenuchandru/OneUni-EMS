'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import PunchWidget from '../../components/PunchWidget';
import Link from 'next/link';
import {
  Activity, Calendar, Clock, FileText, CheckSquare, Shield, LogOut,
  ArrowRight, User, Plus, CheckCircle2, AlertCircle, Users,
  Star, MessageSquare, ChevronRight, X, Building, Home, UserX, Sparkles
} from 'lucide-react';

export default function EmployeeDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Additional Feature States
  const [presenceData, setPresenceData] = useState(null);
  
  // Modals
  const [showRegularizeModal, setShowRegularizeModal] = useState(false);
  const [showPresenceModal, setShowPresenceModal] = useState(false);

  // Form states - Regularization
  const [regDate, setRegDate] = useState(new Date().toISOString().split('T')[0]);
  const [regType, setRegType] = useState('in');
  const [regTime, setRegTime] = useState('09:00');
  const [regMode, setRegMode] = useState('office');
  const [regReason, setRegReason] = useState('');

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard/employee');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }

      // Fetch Who's In Today
      const presRes = await fetch('/api/dashboard/presence-today');
      if (presRes.ok) setPresenceData(await presRes.json());

    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchDashboard();
      }
    }
  }, [loading, user, router]);

  // Submit Attendance Regularization
  const handleSubmitRegularization = async (e) => {
    e.preventDefault();
    try {
      const requestedTimeIso = new Date(`${regDate}T${regTime}:00`).toISOString();
      const res = await fetch('/api/attendance/regularize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: regDate,
          punch_type: regType,
          requested_time: requestedTimeIso,
          work_mode: regMode,
          reason: regReason,
        }),
      });

      if (res.ok) {
        alert('Attendance regularization request submitted to MD for approval!');
        setShowRegularizeModal(false);
        setRegReason('');
        fetchDashboard();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to submit regularization');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || dataLoading || !dashboardData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#051812] text-slate-300">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading OneUni Employee Workspace...</span>
        </div>
      </main>
    );
  }

  const { punch_card, leave_balance, eod_today, tasks, activity_feed } = dashboardData;

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] flex flex-col justify-between">
      <Header />

      <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-10 space-y-6 sm:space-y-8">

        {/* Top Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Punch Status Card */}
          <div className="glass-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Punch Clock Status</span>
              <button
                onClick={() => setShowRegularizeModal(true)}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" /> Request Correction
              </button>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white capitalize">{punch_card.status.replace('_', ' ')}</p>
              {punch_card.punch_in && (
                <p className="text-xs text-slate-400 mt-1">In since: {new Date(punch_card.punch_in.claimed_at).toLocaleTimeString()}</p>
              )}
            </div>
            <Link href="/punch" className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300">
              Open Punch Console <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* EOD Status Card */}
          <div className="glass-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Today's EOD Report</span>
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">
                {eod_today.submitted ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-5 h-5" /> Submitted</span> : <span className="text-amber-400">Pending</span>}
              </p>
              <p className="text-xs text-slate-400 mt-1">Locks at 23:59 IST tonight</p>
            </div>
            <Link href="/eod" className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300">
              Go to EOD Editor <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Punch Widget */}
          <div className="lg:col-span-5 space-y-6">
            <PunchWidget onPunchSuccess={fetchDashboard} />
          </div>

          {/* Tasks & Activity Feed */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            {/* Assigned Tasks Card */}
            <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 sm:pb-4">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-indigo-400 shrink-0" /> My Assigned Tasks ({tasks.length})
                </h2>
              </div>

              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No tasks assigned to you right now.</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((t) => (
                    <div key={t.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white text-sm">{t.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Priority: <span className="uppercase text-sky-400">{t.priority}</span></p>
                      </div>
                      <span className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Activity Feed */}
            <div className="glass-card p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" /> My Activity Feed
                </h2>
                <span className="text-xs text-slate-400">Reverse-chron audit log</span>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {activity_feed.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-emerald-400 font-semibold">{a.action}</span>
                      <span className="text-slate-400 ml-2">({a.entity})</span>
                    </div>
                    <span className="text-slate-500 font-mono">{new Date(a.at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Regularize Punch Modal */}
        {showRegularizeModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-md space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" /> Submit Missing Punch Correction
              </h3>
              <form onSubmit={handleSubmitRegularization} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={regDate}
                    onChange={(e) => setRegDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Punch Type</label>
                  <select
                    value={regType}
                    onChange={(e) => setRegType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  >
                    <option value="in">Punch IN</option>
                    <option value="out">Punch OUT</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Requested Time (HH:MM)</label>
                  <input
                    type="time"
                    required
                    value={regTime}
                    onChange={(e) => setRegTime(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Work Mode</label>
                  <select
                    value={regMode}
                    onChange={(e) => setRegMode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  >
                    <option value="office">Office</option>
                    <option value="wfh">Work From Home (WFH)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Reason for Missing Punch</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Onsite client meeting, network downtime..."
                    value={regReason}
                    onChange={(e) => setRegReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowRegularizeModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-amber-600 text-white font-bold">Submit Request</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Who's In Today Modal */}
        {showPresenceModal && presenceData && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-2xl space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" /> Team Live Presence Today ({presenceData.date})
                </h3>
                <button onClick={() => setShowPresenceModal(false)} className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Office */}
                <div>
                  <h4 className="font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building className="w-4 h-4" /> In Office ({presenceData.office_users?.length})
                  </h4>
                  {presenceData.office_users?.length === 0 ? (
                    <p className="text-slate-500">None in office today.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {presenceData.office_users.map((u) => (
                        <div key={u.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <p className="font-bold text-white">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.designation} • {u.department}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* WFH */}
                <div>
                  <h4 className="font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Home className="w-4 h-4" /> Work From Home ({presenceData.wfh_users?.length})
                  </h4>
                  {presenceData.wfh_users?.length === 0 ? (
                    <p className="text-slate-500">None working from home today.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {presenceData.wfh_users.map((u) => (
                        <div key={u.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <p className="font-bold text-white">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.designation} • {u.department}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* On Leave */}
                <div>
                  <h4 className="font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> On Approved Leave ({presenceData.leave_users?.length})
                  </h4>
                  {presenceData.leave_users?.length === 0 ? (
                    <p className="text-slate-500">No one on leave today.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {presenceData.leave_users.map((u) => (
                        <div key={u.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                          <p className="font-bold text-white">{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.designation} • {u.department}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
