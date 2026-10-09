'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import {
  Activity, Clock, CheckCircle2, XCircle, FileText, FolderKanban,
  Users, LogOut, Plus, AlertCircle, Calendar, ArrowRight, ShieldCheck, Download,
  MessageSquare, Check, Eye, UserCheck, Briefcase, CalendarDays, X, CheckSquare,
  AlertTriangle, Star, Building, Home, ChevronRight, Archive, Trash2, RotateCcw
} from 'lucide-react';

export default function MDDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [fetching, setFetching] = useState(true);

  // Presence State for Who's In Today
  const [presenceData, setPresenceData] = useState(null);
  const [showPresenceModal, setShowPresenceModal] = useState(false);

  // Additional Queue States
  const [pendingRegularizations, setPendingRegularizations] = useState([]);

  // Form & modal states
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [empRoleId, setEmpRoleId] = useState('');
  const [roleList, setRoleList] = useState([]);
  const [empFilterTab, setEmpFilterTab] = useState('active');

  // Employee Full Details Modal state
  const [showFullDetailsModal, setShowFullDetailsModal] = useState(false);
  const [selectedUserFullDetails, setSelectedUserFullDetails] = useState(null);
  const [fetchingFullDetails, setFetchingFullDetails] = useState(false);

  // EOD Review & Activity Feed state
  const [teamEODs, setTeamEODs] = useState([]);
  const [allEODFeed, setAllEODFeed] = useState([]);
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewRatings, setReviewRatings] = useState({});

  const fetchMDData = async () => {
    try {
      const res = await fetch('/api/dashboard/md');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }

      // Fetch system roles for Create User dropdown
      const rolesRes = await fetch('/api/roles');
      if (rolesRes.ok) setRoleList(await rolesRes.json());

      // Fetch Who's In Today Presence
      const presRes = await fetch('/api/dashboard/presence-today');
      if (presRes.ok) setPresenceData(await presRes.json());

      // Fetch Today's Team EOD Reports for Review
      const todayStr = new Date().toISOString().split('T')[0];
      const eodRes = await fetch(`/api/eod/team?target_date=${todayStr}`);
      if (eodRes.ok) {
        const eodData = await eodRes.json();
        setTeamEODs(eodData.submitted || []);
      }

      // Fetch All EOD Activity Feed
      const feedRes = await fetch('/api/eod/feed');
      if (feedRes.ok) {
        const feedData = await feedRes.json();
        setAllEODFeed(feedData);
      }

      // Fetch Pending Attendance Regularizations
      const regRes = await fetch('/api/attendance/regularize/pending');
      if (regRes.ok) setPendingRegularizations(await regRes.json());

    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchMDData();
      }
    }
  }, [loading, user, router]);

  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/export/attendance.csv');
      if (!res.ok) {
        alert('Failed to download CSV export');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Error exporting CSV: ' + err.message);
    }
  };

  const handleOpenFullDetails = async (userId) => {
    setFetchingFullDetails(true);
    setShowFullDetailsModal(true);
    setSelectedUserFullDetails(null);
    try {
      const res = await fetch(`/api/users/${userId}/full-details`);
      if (res.ok) {
        const details = await res.json();
        setSelectedUserFullDetails(details);
      } else {
        alert('Failed to load employee details');
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setFetchingFullDetails(false);
    }
  };

  // Leave Approvals
  const handleApproveLeave = async (leaveId) => {
    try {
      const res = await fetch(`/api/leave/${leaveId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Approved by MD Oversight' }),
      });
      if (res.ok) fetchMDData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectLeave = async (leaveId) => {
    try {
      const res = await fetch(`/api/leave/${leaveId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Rejected by MD Oversight' }),
      });
      if (res.ok) fetchMDData();
    } catch (err) {
      console.error(err);
    }
  };

  // Regularization Decisions
  const handleApproveRegularization = async (regId) => {
    try {
      const res = await fetch(`/api/attendance/regularize/${regId}/approve`, { method: 'POST' });
      if (res.ok) {
        alert('Attendance regularization approved and punch recorded!');
        fetchMDData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectRegularization = async (regId) => {
    try {
      const res = await fetch(`/api/attendance/regularize/${regId}/reject`, { method: 'POST' });
      if (res.ok) {
        alert('Attendance regularization rejected');
        fetchMDData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add / Create Employee
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        email: empEmail,
        full_name: empName,
      };
      if (empPassword) payload.password = empPassword;
      if (empRoleId) payload.role_id = empRoleId;
      else payload.role_name = 'employee';

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const createdUser = await res.json();
        setShowAddEmpModal(false);
        setEmpEmail('');
        setEmpName('');
        setEmpPassword('');
        setEmpRoleId('');
        alert(`User '${createdUser.full_name}' created successfully!\n\nLogin Email: ${createdUser.email}\nInitial Password: ${createdUser.initial_password}\n\n(User will be prompted to set a new password on first login)`);
        fetchMDData();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to create user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Review EOD with Star Rating
  const handleReviewEOD = async (reportId) => {
    const note = reviewNotes[reportId] || 'Reviewed and approved by MD';
    const rating = reviewRatings[reportId] || 5;
    try {
      const res = await fetch(`/api/eod/${reportId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_note: note, rating: parseInt(rating) }),
      });
      if (res.ok) {
        alert('EOD review and rating submitted successfully!');
        fetchMDData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Archive Employee
  const handleArchiveEmployee = async (targetUserId, targetName) => {
    if (!confirm(`Are you sure you want to ARCHIVE employee '${targetName}'? Access will be disabled and user moved to Archive.`)) return;
    try {
      const res = await fetch(`/api/users/${targetUserId}/archive`, { method: 'PATCH' });
      if (res.ok) {
        alert(`Employee '${targetName}' archived successfully.`);
        setShowFullDetailsModal(false);
        fetchMDData();
      } else {
        const json = await res.json();
        alert(json.detail || 'Failed to archive user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Unarchive Employee
  const handleUnarchiveEmployee = async (targetUserId, targetName) => {
    try {
      const res = await fetch(`/api/users/${targetUserId}/unarchive`, { method: 'PATCH' });
      if (res.ok) {
        alert(`Employee '${targetName}' unarchived and restored to active state.`);
        setShowFullDetailsModal(false);
        fetchMDData();
      } else {
        const json = await res.json();
        alert(json.detail || 'Failed to unarchive user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Remove Employee
  const handleRemoveEmployee = async (targetUserId, targetName) => {
    if (!confirm(`WARNING: Are you sure you want to PERMANENTLY REMOVE employee '${targetName}'? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${targetUserId}`, { method: 'DELETE' });
      if (res.ok) {
        alert(`Employee '${targetName}' removed.`);
        setShowFullDetailsModal(false);
        fetchMDData();
      } else {
        const json = await res.json();
        alert(json.detail || 'Failed to remove user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || fetching || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-400">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 animate-spin text-sky-400" />
          <span>Loading MD Executive Portal...</span>
        </div>
      </main>
    );
  }

  const {
    live_punch_feed = [],
    employee_hours_summary = [],
    pending_leaves = [],
    eod_submitted_count = 0,
    projects_count = 0,
    total_employees = 0,
    employees = [],
    deadline_reached_tasks = [],
    deadline_completed_tasks = []
  } = data;

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#090d16] pb-12">
      <Header />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" /> Total Employees
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-2">{total_employees || employees.length || 0}</p>
          </div>
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Regularizations
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-2">{pendingRegularizations.length}</p>
          </div>
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400">EOD Reports</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-purple-400 mt-2">{eod_submitted_count}</p>
          </div>
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400">Active Projects</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-sky-400 mt-2">{projects_count}</p>
          </div>
        </div>

        {/* Who's In Today Presence Bar (Exclusive to MD Dashboard) */}
        {presenceData && (
          <div
            onClick={() => setShowPresenceModal(true)}
            className="glass-card p-4 rounded-2xl border border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Who's In Today ({presenceData.date})</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold"><Building className="w-3.5 h-3.5" /> Office ({presenceData.office_count})</span>
              <span className="flex items-center gap-1 text-sky-400 font-semibold"><Home className="w-3.5 h-3.5" /> WFH ({presenceData.wfh_count})</span>
              <span className="flex items-center gap-1 text-amber-400 font-semibold"><Calendar className="w-3.5 h-3.5" /> Leave ({presenceData.leave_count})</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        )}

        {/* Employee Directory Card */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Employee Directory ({employees.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Manage employee access, view archived users, and inspect complete profile details</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Directory Sub-Filter Bar */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setEmpFilterTab('active')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    empFilterTab === 'active' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-sky-400" /> Active ({employees.filter(e => !e.is_archived).length})
                </button>
                <button
                  type="button"
                  onClick={() => setEmpFilterTab('archived')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    empFilterTab === 'archived' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5 text-amber-400" /> Archived ({employees.filter(e => e.is_archived).length})
                </button>
                <button
                  type="button"
                  onClick={() => setEmpFilterTab('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    empFilterTab === 'all' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-purple-400" /> All ({employees.length})
                </button>
              </div>

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                onClick={() => setShowAddEmpModal(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-600 hover:from-indigo-400 hover:to-sky-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Create User
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {employees
              .filter((emp) => {
                if (empFilterTab === 'active') return !emp.is_archived;
                if (empFilterTab === 'archived') return emp.is_archived;
                return true;
              })
              .map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => handleOpenFullDetails(emp.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-800/80 cursor-pointer transition-all flex items-center justify-between group ${
                    emp.is_archived ? 'opacity-70 border-amber-500/30 bg-slate-950/60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-500 text-white font-bold text-sm flex items-center justify-center uppercase shadow-md overflow-hidden shrink-0">
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full object-cover" />
                      ) : (
                        emp.full_name?.charAt(0) || 'E'
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors leading-snug truncate">{emp.full_name}</p>
                        {emp.is_archived && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">Archived</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{emp.email}</p>
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0 ml-1" />
                </div>
              ))}
          </div>
        </div>

        {/* Attendance Regularizations Queue */}
        <div className="glass-card p-6 rounded-3xl border border-amber-500/20 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" /> Pending Punch Corrections ({pendingRegularizations.length})
            </h2>
          </div>

          {pendingRegularizations.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No missing punch correction requests.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {pendingRegularizations.map((r) => (
                <div key={r.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-white text-sm">{r.user_name}</span>
                    <p className="text-slate-300 mt-0.5">
                      Day: <strong className="text-sky-300">{r.day}</strong> • Requested Time: <strong className="text-amber-300">{new Date(r.requested_time).toLocaleTimeString()}</strong>
                    </p>
                    <p className="text-slate-400 mt-0.5">Reason: {r.reason}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveRegularization(r.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleRejectRegularization(r.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 font-bold flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task Deadlines Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Deadline Reached Tasks */}
          <div className="glass-card p-6 rounded-3xl border border-rose-500/20 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" /> Deadline Reached / Active Tasks
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold">
                {deadline_reached_tasks.length} Tasks
              </span>
            </div>

            {deadline_reached_tasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No overdue active tasks.</p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {deadline_reached_tasks.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{t.title}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {t.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Project: <strong className="text-slate-200">{t.project_name}</strong></span>
                      <span>Assignee: <strong className="text-sky-300">{t.assignee_name}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deadline Completed Tasks */}
          <div className="glass-card p-6 rounded-3xl border border-emerald-500/20 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" /> Deadline Completed Tasks
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                {deadline_completed_tasks.length} Completed
              </span>
            </div>

            {deadline_completed_tasks.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No completed tasks yet.</p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {deadline_completed_tasks.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t.title}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        DONE
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Project: <strong className="text-slate-200">{t.project_name}</strong></span>
                      <span>Completed By: <strong className="text-emerald-300">{t.assignee_name}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* EOD Reviewer & 1-5★ Rating Console */}
        <div className="glass-card p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" /> EOD Reports Review & 1-5★ Rating Console
            </h2>
            <span className="text-xs text-indigo-300 font-semibold">{teamEODs.length} Reports Submitted Today</span>
          </div>

          {teamEODs.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No employee EOD reports submitted today for review.</p>
          ) : (
            <div className="space-y-4">
              {teamEODs.map((report) => (
                <div key={report.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-white text-base">{report.user_name}</span>
                      <p className="text-xs text-slate-400">Submitted at {new Date(report.submitted_at).toLocaleTimeString()}</p>
                    </div>

                    {report.reviewed_by_name ? (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Reviewed ({report.rating || 5}★) by {report.reviewed_by_name}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                        Pending MD Review
                      </span>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {report.body_md}
                  </div>

                  {/* Review Note & 1-5 Star Rating */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[11px] font-bold">Rating:</span>
                      <select
                        value={reviewRatings[report.id] || 5}
                        onChange={(e) => setReviewRatings({ ...reviewRatings, [report.id]: e.target.value })}
                        className="bg-transparent text-amber-400 font-bold outline-none"
                      >
                        <option value="5">5 ★★★★★ (Outstanding)</option>
                        <option value="4">4 ★★★★☆ (Good)</option>
                        <option value="3">3 ★★★☆☆ (Average)</option>
                        <option value="2">2 ★★☆☆☆ (Needs Improvement)</option>
                        <option value="1">1 ★☆☆☆☆ (Unsatisfactory)</option>
                      </select>
                    </div>

                    <input
                      type="text"
                      placeholder="Add MD review note / appreciation comment..."
                      value={reviewNotes[report.id] || ''}
                      onChange={(e) => setReviewNotes({ ...reviewNotes, [report.id]: e.target.value })}
                      className="w-full sm:flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs"
                    />

                    <button
                      onClick={() => handleReviewEOD(report.id)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Submit Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card-wise Team Activity Stream: EODs & Tasks with Employee Names */}
        <div className="glass-card p-6 md:p-8 rounded-3xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Team EOD Reports & Task Activity Cards
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-time card feed showing every employee's EOD Report submission and Task deliverable. Click any card to open full details.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              {allEODFeed.length} Total Reports
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allEODFeed.map((eod) => (
              <div
                key={eod.id}
                onClick={() => setSelectedFeedItem({ type: 'eod', data: eod })}
                className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer space-y-3 hover:scale-[1.01] shadow-xl group"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                    <FileText className="w-3 h-3" /> EOD Report
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{eod.date}</span>
                </div>

                <div>
                  <p className="text-sm font-extrabold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" /> {eod.user_name}
                    <span className="text-[10px] text-slate-400 font-mono uppercase">({eod.user_role})</span>
                  </p>
                  <p className="text-xs text-slate-300 line-clamp-3 mt-2 leading-relaxed bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
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
                    <span className="text-slate-500 italic">Pending MD Review</span>
                  )}
                  <span className="text-emerald-400 group-hover:translate-x-1 transition-transform font-bold flex items-center gap-1">
                    View Full Report <Eye className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Employee Modal */}
        {showAddEmpModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-md space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-400" /> Add New Employee
                </h3>
                <button onClick={() => setShowAddEmpModal(false)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@company.com"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddEmpModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-indigo-600 text-white font-bold">Create Employee</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Employee Full Details Modal */}
        {showFullDetailsModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="glass-card p-6 md:p-8 rounded-3xl border border-indigo-500/30 w-full max-w-4xl space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl my-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-500 flex items-center justify-center text-white text-base font-extrabold uppercase shadow-lg overflow-hidden shrink-0">
                    {selectedUserFullDetails?.profile?.avatar_url ? (
                      <img src={selectedUserFullDetails.profile.avatar_url} alt={selectedUserFullDetails.profile.full_name} className="w-full h-full object-cover" />
                    ) : (
                      selectedUserFullDetails?.profile?.full_name?.charAt(0) || 'U'
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">{selectedUserFullDetails?.profile?.full_name || 'User Details'}</h3>
                    <p className="text-xs text-slate-400">{selectedUserFullDetails?.profile?.email} • Role: {selectedUserFullDetails?.profile?.role}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedUserFullDetails?.profile?.id && (
                    <>
                      <a
                        href={`/api/export/attendance.csv?user_id=${selectedUserFullDetails.profile.id}`}
                        download={`attendance_${selectedUserFullDetails.profile.full_name}.csv`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-4 h-4 text-emerald-400" /> Export CSV
                      </a>

                      {selectedUserFullDetails.profile.is_archived ? (
                        <button
                          type="button"
                          onClick={() => handleUnarchiveEmployee(selectedUserFullDetails.profile.id, selectedUserFullDetails.profile.full_name)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4 text-emerald-400" /> Restore Employee
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArchiveEmployee(selectedUserFullDetails.profile.id, selectedUserFullDetails.profile.full_name)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Archive className="w-4 h-4 text-amber-400" /> Archive Employee
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveEmployee(selectedUserFullDetails.profile.id, selectedUserFullDetails.profile.full_name)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" /> Remove Employee
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setShowFullDetailsModal(false)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {fetchingFullDetails || !selectedUserFullDetails ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Activity className="w-6 h-6 animate-spin text-sky-400 mx-auto" />
                  <p className="text-xs">Fetching complete details...</p>
                </div>
              ) : (
                <div className="space-y-6 text-xs text-slate-300">
                  {/* Leave Balance Overview */}
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px]">Allotted Leave</span>
                      <p className="text-xl font-black text-white mt-1">{selectedUserFullDetails.leave_balance?.allotted}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px]">Used Leave</span>
                      <p className="text-xl font-black text-amber-400 mt-1">{selectedUserFullDetails.leave_balance?.used}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase font-semibold text-[10px]">Remaining Balance</span>
                      <p className="text-xl font-black text-emerald-400 mt-1">{selectedUserFullDetails.leave_balance?.remaining}</p>
                    </div>
                  </div>

                  {/* Assigned Tasks */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-sky-400" /> Assigned Tasks ({selectedUserFullDetails.tasks?.length})
                    </h4>
                    {selectedUserFullDetails.tasks?.length === 0 ? (
                      <p className="text-slate-500 py-2">No tasks assigned.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedUserFullDetails.tasks.map((t) => (
                          <div key={t.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-white">{t.title}</p>
                              <p className="text-[10px] text-slate-400">Project: {t.project_name}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${t.status === 'done' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'}`}>
                              {t.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Who's In Today Modal (Exclusive to MD Dashboard) */}
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
                          <p className="text-[10px] text-slate-400">{u.designation || 'Team Member'} • {u.department || 'Engineering'}</p>
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
                          <p className="text-[10px] text-slate-400">{u.designation || 'Team Member'} • {u.department || 'Engineering'}</p>
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
                          <p className="text-[10px] text-slate-400">{u.designation || 'Team Member'} • {u.department || 'Engineering'}</p>
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
      {/* Full Details Popup Modal for EOD / Task in MD Dashboard */}
      {selectedFeedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-emerald-700/60 w-full max-w-2xl space-y-5 bg-[#041a13]/95 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-900/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-base font-extrabold uppercase shadow-lg">
                  {selectedFeedItem.data.user_name?.charAt(0) || 'E'}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    EOD Report Details — {selectedFeedItem.data.user_name}
                  </h3>
                  <p className="text-xs text-emerald-400 font-semibold uppercase">
                    Role: {selectedFeedItem.data.user_role || 'Employee'} • Date: {selectedFeedItem.data.date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFeedItem(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#02100b] p-3 rounded-2xl border border-emerald-900/70">
                <div>
                  <span className="text-slate-400 uppercase text-[10px]">Submission Time</span>
                  <p className="font-mono text-sm font-bold text-white">
                    {new Date(selectedFeedItem.data.submitted_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px]">MD Review & Rating</span>
                  <p className="font-bold text-amber-400">
                    {selectedFeedItem.data.rating ? `★ Rated ${selectedFeedItem.data.rating}/5 Stars` : 'Pending Review'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Submitted Content & Accomplishments</label>
                <div className="p-4 rounded-2xl bg-[#02100b] border border-emerald-900/70 text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedFeedItem.data.body_md}
                </div>
              </div>

              {selectedFeedItem.data.review_note && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                  <p className="text-[10px] uppercase font-black text-amber-400">MD Reviewer Feedback</p>
                  <p className="text-xs">{selectedFeedItem.data.review_note}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-emerald-900/80">
              <button
                onClick={() => setSelectedFeedItem(null)}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal for MD */}
      {showAddEmpModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" /> Create New System User
              </h3>
              <button
                onClick={() => setShowAddEmpModal(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. john@company.com"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Initial Password (Optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank for auto-generated temp password"
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">System Role *</label>
                <select
                  value={empRoleId}
                  onChange={(e) => setEmpRoleId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-indigo-500"
                >
                  <option value="">Select Role (Default: Employee)</option>
                  {roleList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
