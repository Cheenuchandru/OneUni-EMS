'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import {
  Shield, Activity, Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  FolderKanban, Filter, UserCheck, FileText, Award, RefreshCw, Star, X, Eye, User
} from 'lucide-react';

export default function ActivityLogPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'eod' | 'tasks' | 'attendance' | 'audit'
  const [dashboardData, setDashboardData] = useState(null);
  const [eodFeed, setEodFeed] = useState([]);
  const [calendarStatuses, setCalendarStatuses] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Detail Modal Popup State
  const [selectedItem, setSelectedItem] = useState(null); // { type: 'eod'|'task', data: ... }

  const monthStr = new Date().toISOString().slice(0, 7);

  const fetchActivityData = async () => {
    setDataLoading(true);
    try {
      // Fetch employee dashboard payload
      const dashRes = await fetch('/api/dashboard/employee');
      if (dashRes.ok) setDashboardData(await dashRes.json());

      // Fetch user calendar statuses
      const calRes = await fetch(`/api/calendar/me?month=${monthStr}`);
      if (calRes.ok) setCalendarStatuses(await calRes.json());

      // Fetch EOD Activity Feed
      const eodRes = await fetch('/api/eod/feed');
      if (eodRes.ok) setEodFeed(await eodRes.json());

    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else fetchActivityData();
    }
  }, [loading, user, router]);

  if (loading || dataLoading || !dashboardData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#051812] text-slate-300">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading Activity & Audit Log...</span>
        </div>
      </main>
    );
  }

  const { tasks = [], activity_feed = [] } = dashboardData;

  // Calculate Attendance Stats
  const presentDays = calendarStatuses.filter(s => s.status === 'present' || s.status === 'wfh' || s.status === 'half');
  const absentDays = calendarStatuses.filter(s => s.status === 'absent');
  const leaveDays = calendarStatuses.filter(s => s.status === 'leave');
  const otDays = calendarStatuses.filter(s => s.status === 'ot');

  // Combined Feed Items (EOD Reports + Tasks)
  const combinedFeed = [
    ...eodFeed.map(item => ({ feedType: 'eod', dateSort: new Date(item.submitted_at).getTime(), data: item })),
    ...tasks.map(item => ({ feedType: 'task', dateSort: item.due_date ? new Date(item.due_date).getTime() : Date.now(), data: item }))
  ].sort((a, b) => b.dateSort - a.dateSort);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] text-white pb-16">
      <Header />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-emerald-900/40">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Shield className="w-8 h-8 text-emerald-400" /> Activity & Audit Log Stream
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Complete card-wise log of submitted EOD Reports, assigned Tasks, attendance history, and system audit events for <strong className="text-white">{user.full_name}</strong>.
            </p>
          </div>

          <button
            onClick={fetchActivityData}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" /> Refresh Log
          </button>
        </div>

        {/* Top Metrics Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-2xl border border-emerald-900/40 text-center space-y-1 bg-[#03140f]/90">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Submitted EODs</span>
            <p className="text-2xl font-black text-amber-400">{eodFeed.length} Reports</p>
          </div>
          <div className="glass-card p-4 rounded-2xl border border-emerald-900/40 text-center space-y-1 bg-[#03140f]/90">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active & Completed Tasks</span>
            <p className="text-2xl font-black text-sky-400">{tasks.length} Deliverables</p>
          </div>
          <div className="glass-card p-4 rounded-2xl border border-emerald-900/40 text-center space-y-1 bg-[#03140f]/90">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Days Present / WFH</span>
            <p className="text-2xl font-black text-emerald-400">{presentDays.length} Days</p>
          </div>
          <div className="glass-card p-4 rounded-2xl border border-emerald-900/40 text-center space-y-1 bg-[#03140f]/90">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Overtime (OT)</span>
            <p className="text-2xl font-black text-emerald-300">{otDays.length} Days</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-emerald-900/40 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'feed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" /> All Activity Cards ({combinedFeed.length})
          </button>

          <button
            onClick={() => setActiveTab('eod')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'eod'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" /> EOD Reports ({eodFeed.length})
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderKanban className="w-4 h-4 text-sky-400" /> Tasks & Deliverables ({tasks.length})
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-400" /> Attendance History ({calendarStatuses.length})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 text-indigo-400" /> System Audit Trail ({activity_feed.length})
          </button>
        </div>

        {/* Tab 1: Combined Activity Cards Stream */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Activity Stream (Click any card to view full details)
            </h3>

            {combinedFeed.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center">No activity items recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {combinedFeed.map((item, idx) => {
                  if (item.feedType === 'eod') {
                    const eod = item.data;
                    return (
                      <div
                        key={`eod-${eod.id}-${idx}`}
                        onClick={() => setSelectedItem({ type: 'eod', data: eod })}
                        className="glass-card p-5 rounded-3xl border border-amber-500/30 hover:border-amber-400 transition-all cursor-pointer space-y-3 bg-[#03140f]/90 hover:scale-[1.01] shadow-lg group"
                      >
                        <div className="flex items-center justify-between border-b border-emerald-900/50 pb-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                            <FileText className="w-3 h-3" /> EOD Report
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{eod.date}</span>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-emerald-400" /> {eod.user_name}
                          </p>
                          <p className="text-[11px] text-slate-300 line-clamp-3 mt-1.5 leading-relaxed bg-[#02100b] p-2.5 rounded-xl border border-emerald-900/60">
                            {eod.body_md}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px]">
                          {eod.rating ? (
                            <div className="flex items-center gap-1 text-amber-400 font-bold">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`w-3 h-3 ${i < eod.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                              ))}
                              <span className="ml-1 text-xs text-white">{eod.rating}/5</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Pending Review</span>
                          )}
                          <span className="text-amber-400 group-hover:translate-x-1 transition-transform font-bold flex items-center gap-1">
                            View Full Report <Eye className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    const task = item.data;
                    return (
                      <div
                        key={`task-${task.id}-${idx}`}
                        onClick={() => setSelectedItem({ type: 'task', data: task })}
                        className="glass-card p-5 rounded-3xl border border-sky-500/30 hover:border-sky-400 transition-all cursor-pointer space-y-3 bg-[#03140f]/90 hover:scale-[1.01] shadow-lg group"
                      >
                        <div className="flex items-center justify-between border-b border-emerald-900/50 pb-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                            <FolderKanban className="w-3 h-3" /> Task Deliverable
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                            task.status === 'done' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors">{task.title}</p>
                          <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Assignee: {task.assignee_name || user.full_name}</p>
                          {task.description && (
                            <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 bg-[#02100b] p-2 rounded-xl border border-emerald-900/60">
                              {task.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px]">
                          <span className="text-slate-400">Due: <strong className="text-white">{task.due_date || 'Ongoing'}</strong></span>
                          <span className="text-sky-400 group-hover:translate-x-1 transition-transform font-bold flex items-center gap-1">
                            View Full Details <Eye className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: EOD Reports Cards */}
        {activeTab === 'eod' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" /> Submitted EOD Reports ({eodFeed.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {eodFeed.map((eod) => (
                <div
                  key={eod.id}
                  onClick={() => setSelectedItem({ type: 'eod', data: eod })}
                  className="glass-card p-5 rounded-3xl border border-amber-500/30 hover:border-amber-400 transition-all cursor-pointer space-y-3 bg-[#03140f]/90 hover:scale-[1.01] shadow-lg group"
                >
                  <div className="flex items-center justify-between border-b border-emerald-900/50 pb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                      {eod.date}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">{eod.user_name}</span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-4 leading-relaxed bg-[#02100b] p-3 rounded-2xl border border-emerald-900/60">
                    {eod.body_md}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    {eod.rating ? (
                      <div className="flex items-center gap-1 text-amber-400 font-bold">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < eod.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Submitted</span>
                    )}
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      View Report <Eye className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Tasks Cards */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-sky-400" /> Task Deliverables ({tasks.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedItem({ type: 'task', data: t })}
                  className="glass-card p-5 rounded-3xl border border-sky-500/30 hover:border-sky-400 transition-all cursor-pointer space-y-3 bg-[#03140f]/90 hover:scale-[1.01] shadow-lg group"
                >
                  <div className="flex items-center justify-between border-b border-emerald-900/50 pb-2">
                    <span className="font-bold text-white text-xs truncate max-w-[150px]">{t.title}</span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-sky-500/20 text-sky-300">
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-3 bg-[#02100b] p-3 rounded-2xl border border-emerald-900/60">
                    {t.description || 'No description provided.'}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="text-emerald-400 font-semibold">Priority: {t.priority}</span>
                    <span className="text-sky-400 font-bold flex items-center gap-1">
                      View Task <Eye className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Attendance History */}
        {activeTab === 'attendance' && (
          <div className="glass-card p-6 rounded-3xl border border-emerald-900/40 space-y-4 bg-[#03140f]/90">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" /> Monthly Attendance History ({monthStr})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {calendarStatuses.map((s) => (
                <div
                  key={s.date}
                  className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                    s.status === 'present' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' :
                    s.status === 'leave' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' :
                    s.status === 'wfh' ? 'bg-sky-500/10 border-sky-500/30 text-sky-200' :
                    s.status === 'ot' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' :
                    s.status === 'absent' ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' :
                    'bg-slate-900/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>
                    <p className="font-mono font-bold text-sm text-white">{s.date}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Source: {s.source}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Audit Trail */}
        {activeTab === 'audit' && (
          <div className="glass-card p-6 rounded-3xl border border-emerald-900/40 space-y-4 bg-[#03140f]/90">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" /> Immutable System Audit Trail
            </h3>

            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {activity_feed.map((a) => (
                <div key={a.id} className="p-3.5 rounded-xl bg-[#02100b] border border-emerald-900/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-emerald-400 font-bold">{a.action}</span>
                    <span className="text-slate-400 ml-2">[{a.entity}]</span>
                  </div>
                  <span className="text-slate-500 font-mono">{new Date(a.at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Popup Modal (EOD or Task) */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-emerald-700/60 w-full max-w-2xl space-y-5 bg-[#041a13]/95 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-900/80 pb-4">
              <div className="flex items-center gap-2">
                {selectedItem.type === 'eod' ? (
                  <FileText className="w-6 h-6 text-amber-400" />
                ) : (
                  <FolderKanban className="w-6 h-6 text-sky-400" />
                )}
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {selectedItem.type === 'eod' ? `Full EOD Report Details` : `Task Deliverable Details`}
                  </h3>
                  <p className="text-xs text-emerald-400 font-semibold">
                    Employee: {selectedItem.data.user_name || selectedItem.data.assignee_name || user.full_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-xl bg-emerald-900/40 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedItem.type === 'eod' ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-[#02100b] p-3 rounded-2xl border border-emerald-900/70">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">Submission Date</span>
                    <p className="font-mono text-sm font-bold text-white">{selectedItem.data.date}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">MD Review Status</span>
                    <p className="font-bold text-amber-400">
                      {selectedItem.data.rating ? `★ Rated ${selectedItem.data.rating}/5 Stars` : 'Submitted / Pending Review'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">Report Content</label>
                  <div className="p-4 rounded-2xl bg-[#02100b] border border-emerald-900/70 text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {selectedItem.data.body_md}
                  </div>
                </div>

                {selectedItem.data.review_note && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                    <p className="text-[10px] uppercase font-black text-amber-400">MD Reviewer Feedback</p>
                    <p className="text-xs">{selectedItem.data.review_note}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#02100b] p-3 rounded-2xl border border-emerald-900/70">
                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">Status</span>
                    <p className="font-bold text-emerald-400 uppercase">{selectedItem.data.status?.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">Priority</span>
                    <p className="font-bold text-amber-400 uppercase">{selectedItem.data.priority || 'Normal'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase text-[10px]">Due Date</span>
                    <p className="font-mono text-white font-bold">{selectedItem.data.due_date || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 uppercase font-bold text-[10px]">Task Title & Deliverables</label>
                  <h4 className="text-sm font-bold text-white">{selectedItem.data.title}</h4>
                  <div className="p-4 rounded-2xl bg-[#02100b] border border-emerald-900/70 text-slate-200 leading-relaxed font-sans whitespace-pre-wrap mt-2">
                    {selectedItem.data.description || 'No additional deliverable details specified.'}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-emerald-900/80">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
