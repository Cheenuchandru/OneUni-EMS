'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import {
  Activity, ShieldCheck, Users, Key, Mail, FileText, Plus, LogOut,
  ArrowLeft, Clock, Shield, Download, Check, X, Eye, FolderKanban,
  Calendar, AlertCircle, EyeOff, UserCheck, Megaphone, Settings,
  RotateCcw, Sparkles, Filter, CheckCircle2, XCircle, ChevronRight,
  Archive, Trash2, UserX
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [fetching, setFetching] = useState(true);

  // Active Tab: 'users' | 'announcements' | 'attendance' | 'calendar' | 'leave' | 'eod' | 'projects' | 'roles' | 'mail' | 'audit'
  const [activeTab, setActiveTab] = useState('users');

  // Data lists
  const [userList, setUserList] = useState([]);
  const [roleList, setRoleList] = useState([]);
  const [mailRules, setMailRules] = useState([]);
  const [teamEODs, setTeamEODs] = useState([]);
  const [announcementsList, setAnnouncementsList] = useState([]);
  const [calendarDays, setCalendarDays] = useState([]);
  const [pendingRegularizations, setPendingRegularizations] = useState([]);

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showFullDetailsModal, setShowFullDetailsModal] = useState(false);

  // Form states - Create User
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  // Form states - Reset Password
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetNewPassword, setResetNewPassword] = useState('');

  // Form states - Create Announcement
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(false);

  // Form states - Calendar Day Upsert
  const [calDate, setCalDate] = useState(new Date().toISOString().split('T')[0]);
  const [calDayType, setCalDayType] = useState('holiday');
  const [calLabel, setCalLabel] = useState('');

  // Employee Full Details Modal state
  const [selectedUserFullDetails, setSelectedUserFullDetails] = useState(null);
  const [fetchingFullDetails, setFetchingFullDetails] = useState(false);

  const fetchAdminData = async () => {
    try {
      const res = await fetch('/api/dashboard/admin');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }

      // Fetch users
      const uRes = await fetch('/api/users');
      if (uRes.ok) setUserList(await uRes.json());

      // Fetch roles
      const rRes = await fetch('/api/roles');
      if (rRes.ok) setRoleList(await rRes.json());

      // Fetch mail rules
      const mRes = await fetch('/api/mail/rules');
      if (mRes.ok) setMailRules(await mRes.json());

      // Fetch today's EODs
      const todayStr = new Date().toISOString().split('T')[0];
      const eodRes = await fetch(`/api/eod/team?target_date=${todayStr}`);
      if (eodRes.ok) {
        const eodData = await eodRes.json();
        setTeamEODs(eodData.submitted || []);
      }

      // Fetch Announcements
      const annRes = await fetch('/api/announcements');
      if (annRes.ok) setAnnouncementsList(await annRes.json());

      // Fetch Calendar Days for current month
      const currentMonth = todayStr.substring(0, 7);
      const calRes = await fetch(`/api/calendar/days?month=${currentMonth}`);
      if (calRes.ok) setCalendarDays(await calRes.json());

      // Fetch Pending Regularizations
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
      if (!user || user.role !== 'admin') {
        router.push('/login');
      } else {
        fetchAdminData();
      }
    }
  }, [loading, user, router]);

  // CSV Export
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

  // Full Details Modal
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

  // User status toggle
  const handleToggleUserStatus = async (targetUser) => {
    try {
      const newStatus = !targetUser.is_active;
      const res = await fetch(`/api/users/${targetUser.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (res.ok) {
        alert(`User '${targetUser.full_name}' set to ${newStatus ? 'ACTIVE' : 'INACTIVE'}`);
        fetchAdminData();
      } else {
        alert('Failed to update status');
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const [userFilterTab, setUserFilterTab] = useState('active');

  // Archive User
  const handleArchiveUser = async (targetUser) => {
    if (!confirm(`Are you sure you want to ARCHIVE employee '${targetUser.full_name}'? Access will be disabled and user will be moved to Archive.`)) return;
    try {
      const res = await fetch(`/api/users/${targetUser.id}/archive`, { method: 'PATCH' });
      if (res.ok) {
        alert(`Employee '${targetUser.full_name}' archived successfully.`);
        fetchAdminData();
      } else {
        const json = await res.json();
        alert(json.detail || 'Failed to archive user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Unarchive User
  const handleUnarchiveUser = async (targetUser) => {
    try {
      const res = await fetch(`/api/users/${targetUser.id}/unarchive`, { method: 'PATCH' });
      if (res.ok) {
        alert(`Employee '${targetUser.full_name}' unarchived and restored to active state.`);
        fetchAdminData();
      } else {
        const json = await res.json();
        alert(json.detail || 'Failed to unarchive user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Remove / Delete User
  const handleRemoveUser = async (targetUser) => {
    if (!confirm(`WARNING: Are you sure you want to PERMANENTLY REMOVE employee '${targetUser.full_name}' (${targetUser.email})? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert(`Employee '${targetUser.full_name}' removed.`);
        fetchAdminData();
      } else {
        const json = await res.json();
        alert(json.detail || 'Failed to remove user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Reset Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTargetUser || !resetNewPassword) return;
    try {
      const res = await fetch(`/api/users/${resetTargetUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: resetNewPassword }),
      });
      if (res.ok) {
        alert(`Password for '${resetTargetUser.full_name}' updated successfully!`);
        setShowResetPasswordModal(false);
        setResetNewPassword('');
        setResetTargetUser(null);
      } else {
        alert('Failed to reset password');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          full_name: newName,
          role_id: newRoleId,
        }),
      });

      if (res.ok) {
        const createdUser = await res.json();
        setShowUserModal(false);
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        alert(`User '${createdUser.full_name}' created successfully!\n\nLogin Email: ${createdUser.email}\nInitial Password: ${createdUser.initial_password}\n\n(User will be prompted to set a new password on first login)`);
        fetchAdminData();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to create user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Create Announcement
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: annTitle,
          body_md: annBody,
          pinned: annPinned,
        }),
      });

      if (res.ok) {
        setShowAnnouncementModal(false);
        setAnnTitle('');
        setAnnBody('');
        setAnnPinned(false);
        alert('Announcement broadcasted successfully to all users!');
        fetchAdminData();
      } else {
        alert('Failed to create announcement');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Calendar Day Upsert
  const handleUpsertCalendarDay = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/calendar/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: calDate,
          day_type: calDayType,
          label: calLabel,
        }),
      });

      if (res.ok) {
        setShowCalendarModal(false);
        setCalLabel('');
        alert(`Calendar day status updated for ${calDate}`);
        fetchAdminData();
      } else {
        alert('Failed to update calendar day');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Auto mark job trigger
  const handleTriggerAutoMarkJob = async () => {
    const targetDate = prompt('Enter date to run Auto-Mark Attendance Job (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!targetDate) return;
    try {
      const res = await fetch('/api/calendar/admin/jobs/mark-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: targetDate }),
      });
      if (res.ok) {
        const resJson = await res.json();
        alert(`Auto-Mark job complete! Marked: ${resJson.marked_count || 0} records for ${targetDate}`);
        fetchAdminData();
      } else {
        alert('Failed to run auto-mark job');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Approve / Reject Leave
  const handleApproveLeave = async (leaveId) => {
    try {
      const res = await fetch(`/api/leave/${leaveId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Approved by System Admin' }),
      });
      if (res.ok) {
        alert('Leave approved successfully!');
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectLeave = async (leaveId) => {
    try {
      const res = await fetch(`/api/leave/${leaveId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Rejected by System Admin' }),
      });
      if (res.ok) {
        alert('Leave rejected');
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || fetching || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-400">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 animate-spin text-sky-400" />
          <span>Loading Admin Control Center...</span>
        </div>
      </main>
    );
  }

  const { system_stats, audit_logs = [], pending_leaves = [], live_punch_feed = [] } = data;

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#090d16] pb-12">
      <Header />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-6">

        {/* Quick Actions Hub Header */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">System Governance & Operations</span>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-sky-400" /> Admin Control Center
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowUserModal(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-sky-600/20"
            >
              <Plus className="w-4 h-4" /> Create User
            </button>

            <button
              onClick={() => setShowAnnouncementModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-600/20"
            >
              <Megaphone className="w-4 h-4" /> Broadcast News
            </button>

            <button
              onClick={() => setShowCalendarModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Calendar className="w-4 h-4" /> Set Holiday
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>

            <button
              onClick={handleTriggerAutoMarkJob}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
              title="Run Auto-Mark Attendance Engine"
            >
              <Sparkles className="w-4 h-4 text-amber-400" /> Auto-Mark
            </button>
          </div>
        </div>

        {/* System Stats Cards Grid (2-cols on mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-400" /> Total Users
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-2">{system_stats.total_users || userList.length}</p>
          </div>
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" /> Pending Leaves
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-2">{system_stats.pending_leaves_count || pending_leaves.length}</p>
          </div>
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" /> EOD Reports
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2">{system_stats.eod_submitted_count || teamEODs.length}</p>
          </div>
          <div className="glass-card p-4 sm:p-5 rounded-3xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" /> Audit Trail Logs
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-2">{system_stats.total_audit_logs}</p>
          </div>
        </div>

        {/* Scrollable Module Navigation Tabs */}
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-2 min-w-max border-b border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'users' ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Directory ({userList.length})
            </button>

            <button
              onClick={() => setActiveTab('announcements')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'announcements' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" /> Broadcasts ({announcementsList.length})
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'attendance' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Attendance & Export
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'calendar' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar & Holidays
            </button>

            <button
              onClick={() => setActiveTab('leave')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'leave' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Leave Queue ({pending_leaves.length})
            </button>

            <button
              onClick={() => setActiveTab('eod')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'eod' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Team EODs ({teamEODs.length})
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'projects' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" /> Projects & Tasks
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'roles' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" /> RBAC Roles ({roleList.length})
            </button>

            <button
              onClick={() => setActiveTab('mail')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'mail' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" /> SMTP Rules ({mailRules.length})
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                activeTab === 'audit' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Audit Trail ({audit_logs.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Users Directory */}
        {activeTab === 'users' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" /> System Users Directory ({userList.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Manage user access, toggle status, reset passwords & inspect complete history</p>
              </div>

              {/* User Directory Sub-Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUserFilterTab('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    userFilterTab === 'active' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" /> Active ({userList.filter(u => !u.is_archived).length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilterTab('archived')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    userFilterTab === 'archived' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" /> Archived ({userList.filter(u => u.is_archived).length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilterTab('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    userFilterTab === 'all' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> All ({userList.length})
                </button>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create User
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300 min-w-[750px]">
                <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {userList
                    .filter((u) => {
                      if (userFilterTab === 'active') return !u.is_archived;
                      if (userFilterTab === 'archived') return u.is_archived;
                      return true;
                    })
                    .map((u) => (
                      <tr key={u.id} className={`hover:bg-slate-900/40 ${u.is_archived ? 'opacity-70 bg-slate-950/40' : ''}`}>
                        <td className="p-3 font-semibold text-white flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold uppercase overflow-hidden shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                            ) : (
                              u.full_name?.charAt(0)
                            )}
                          </div>
                          <div>
                            <span className="block leading-tight">{u.full_name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{u.designation || 'Team Member'}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-300">{u.email}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 text-xs font-bold uppercase rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            {u.role_name}
                          </span>
                        </td>
                        <td className="p-3">
                          {u.is_archived ? (
                            <span className="px-2.5 py-1 text-xs font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 w-fit">
                              <Archive className="w-3 h-3" /> Archived
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 border ${
                                u.is_active
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                              title="Click to toggle active status"
                            >
                              {u.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {u.is_active ? 'Active' : 'Inactive'}
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setResetTargetUser(u);
                                setShowResetPasswordModal(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1"
                              title="Reset password"
                            >
                              <Key className="w-3 h-3" /> Pass
                            </button>
                            <button
                              onClick={() => handleOpenFullDetails(u.id)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-xs font-bold flex items-center gap-1"
                              title="Full Details"
                            >
                              <Eye className="w-3.5 h-3.5" /> Details
                            </button>

                            {/* Archive / Unarchive Button */}
                            {u.is_archived ? (
                              <button
                                onClick={() => handleUnarchiveUser(u)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1"
                                title="Unarchive / Restore Employee"
                              >
                                <RotateCcw className="w-3 h-3" /> Restore
                              </button>
                            ) : (
                              <button
                                onClick={() => handleArchiveUser(u)}
                                className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold flex items-center gap-1"
                                title="Archive Employee Access"
                              >
                                <Archive className="w-3 h-3" /> Archive
                              </button>
                            )}

                            {/* Delete / Remove Button */}
                            <button
                              onClick={() => handleRemoveUser(u)}
                              className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold flex items-center gap-1"
                              title="Remove Employee"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Announcements & Broadcasts */}
        {activeTab === 'announcements' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-purple-400" /> Broadcasts & Announcements Hub
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Post news, official notices and company alerts sent to all employees</p>
              </div>
              <button
                onClick={() => setShowAnnouncementModal(true)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Broadcast Announcement
              </button>
            </div>

            {announcementsList.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No announcements published yet.</p>
            ) : (
              <div className="space-y-4">
                {announcementsList.map((ann) => (
                  <div key={ann.id} className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ann.pinned && (
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Pinned
                          </span>
                        )}
                        <h3 className="font-bold text-white text-base">{ann.title}</h3>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(ann.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-wrap">{ann.body_md}</p>
                    <p className="text-[10px] text-slate-500 pt-1">Posted by: {ann.author_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Attendance & Export CSV */}
        {activeTab === 'attendance' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" /> Attendance Control & Export
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Live punch records today, device tracking, and instant CSV data export</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTriggerAutoMarkJob}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" /> Run Auto-Mark Job
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Live Daily Punch Feed ({live_punch_feed.length})</h3>
              {live_punch_feed.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No punch records logged today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300 min-w-[650px]">
                    <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400">
                      <tr>
                        <th className="p-3">Employee</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Claimed Time</th>
                        <th className="p-3">Work Mode</th>
                        <th className="p-3">Device & IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      {live_punch_feed.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-semibold text-white font-sans text-sm">{p.user_name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.punch_type === 'in' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                              {p.punch_type}
                            </span>
                          </td>
                          <td className="p-3 text-slate-200">{new Date(p.claimed_at).toLocaleTimeString()}</td>
                          <td className="p-3 text-sky-400 uppercase font-bold">{p.work_mode}</td>
                          <td className="p-3 text-slate-400">{p.device_type} ({p.ip})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Calendar & Holidays */}
        {activeTab === 'calendar' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-400" /> Company Calendar & Holiday Rules
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Declare official holidays, weekends, or company events for attendance calculation</p>
              </div>
              <button
                onClick={() => setShowCalendarModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" /> Declare Holiday / Day Status
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Configured Days ({calendarDays.length})</h3>
              {calendarDays.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No custom calendar day rules for this month.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calendarDays.map((d) => (
                    <div key={d.date} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white text-sm">{d.date}</span>
                        <p className="text-xs text-slate-400">{d.label || 'Day override'}</p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded ${
                        d.day_type === 'holiday' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        d.day_type === 'weekend' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {d.day_type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Leave Approvals Queue */}
        {activeTab === 'leave' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <Calendar className="w-5 h-5 text-amber-400" /> Pending Leave Approvals Queue ({pending_leaves.length})
            </h2>

            {pending_leaves.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No pending leave requests awaiting decision.</p>
            ) : (
              <div className="space-y-3">
                {pending_leaves.map((l) => (
                  <div key={l.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                    <div>
                      <span className="font-extrabold text-white text-sm">{l.user_name}</span>
                      <p className="text-slate-300 mt-0.5">Dates: <strong className="text-sky-300">{l.from_date}</strong> to <strong className="text-sky-300">{l.to_date}</strong> {l.half_day && '(Half Day)'}</p>
                      <p className="text-slate-400 mt-0.5">Reason: {l.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveLeave(l.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleRejectLeave(l.id)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 font-bold flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Team EOD Reports */}
        {activeTab === 'eod' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <FileText className="w-5 h-5 text-indigo-400" /> Submitted Team EOD Reports ({teamEODs.length})
            </h2>

            {teamEODs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No employee EOD reports submitted today.</p>
            ) : (
              <div className="space-y-4">
                {teamEODs.map((report) => (
                  <div key={report.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white">{report.user_name}</span>
                      <span className="text-[10px] text-slate-400">{new Date(report.submitted_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap">
                      {report.body_md}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Projects & Tasks Overview */}
        {activeTab === 'projects' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-purple-400" /> Projects & Tasks Workspace
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">System admin has complete authority over projects, sprints & task assignments</p>
              </div>
              <Link href="/projects" className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5">
                Open Full Kanban Board <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Tab 8: Roles */}
        {activeTab === 'roles' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <Key className="w-5 h-5 text-rose-400" /> RBAC Role & Permission Registry ({roleList.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roleList.map((r) => (
                <div key={r.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold uppercase text-white">{r.name}</span>
                    {r.is_system && <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">System Role</span>}
                  </div>
                  <p className="text-xs text-slate-400">Granted Permissions: <strong className="text-sky-400">{r.permissions.length} keys</strong></p>
                  <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
                    {r.permissions.map((p) => (
                      <span key={p} className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 9: Mail Rules */}
        {activeTab === 'mail' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <Mail className="w-5 h-5 text-amber-400" /> Gmail SMTP Alert & Routing Rules ({mailRules.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300 min-w-[600px]">
                <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400">
                  <tr>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Recipient Type</th>
                    <th className="p-3">Recipient Value</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {mailRules.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-amber-400">{m.event_type}</td>
                      <td className="p-3 text-slate-300">{m.recipient_type}</td>
                      <td className="p-3 text-white">{m.recipient_value}</td>
                      <td className="p-3 font-bold text-emerald-400">{m.enabled ? 'Active' : 'Disabled'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 10: Audit */}
        {activeTab === 'audit' && (
          <div className="glass-card p-5 sm:p-8 rounded-3xl border border-slate-800 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Immutable DB Security Audit Trail ({audit_logs.length})
            </h2>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {audit_logs.map((a) => (
                <div key={a.id} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold uppercase text-sky-400 font-mono">{a.action}</span>
                      <span className="text-slate-400 font-mono">({a.entity})</span>
                    </div>
                    <p className="text-slate-400">
                      Actor ID: <span className="text-slate-200 font-semibold">{a.actor_id}</span> ({a.actor_role})
                    </p>
                  </div>
                  <div className="text-right font-mono text-slate-500">
                    {new Date(a.at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showUserModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-md space-y-6">
              <h3 className="text-xl font-bold text-white">Create New System User</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Full Name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="Email Address..."
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                />
                <input
                  type="password"
                  required
                  placeholder="Password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                />
                <select
                  required
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                >
                  <option value="">Select Role...</option>
                  {roleList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name.toUpperCase()}
                    </option>
                  ))}
                </select>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowUserModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-sky-600 text-white text-xs font-bold">Create User</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPasswordModal && resetTargetUser && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-md space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" /> Reset Password
              </h3>
              <p className="text-xs text-slate-300">Set new password for <strong className="text-white">{resetTargetUser.full_name}</strong> ({resetTargetUser.email}):</p>
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <input
                  type="password"
                  required
                  placeholder="New Password..."
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowResetPasswordModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-amber-600 text-white text-xs font-bold">Save New Password</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Broadcast Announcement Modal */}
        {showAnnouncementModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-lg space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-purple-400" /> Broadcast Company Announcement
              </h3>
              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Announcement Title..."
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                />
                <textarea
                  required
                  rows={5}
                  placeholder="Announcement body (Markdown supported)..."
                  value={annBody}
                  onChange={(e) => setAnnBody(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm font-sans"
                />
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Pin this announcement to top of employee notifications</span>
                </label>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAnnouncementModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-purple-600 text-white text-xs font-bold">Broadcast Now</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Declare Calendar Day / Holiday Modal */}
        {showCalendarModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800 w-full max-w-md space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" /> Set Calendar Holiday / Day Status
              </h3>
              <form onSubmit={handleUpsertCalendarDay} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={calDate}
                    onChange={(e) => setCalDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Day Type</label>
                  <select
                    value={calDayType}
                    onChange={(e) => setCalDayType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  >
                    <option value="holiday">HOLIDAY (Official Public / Company Holiday)</option>
                    <option value="weekend">WEEKEND (Saturday / Sunday Non-Working)</option>
                    <option value="working">WORKING (Official Working Day)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Custom Description / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Diwali Holiday, Annual Retreat..."
                    value={calLabel}
                    onChange={(e) => setCalLabel(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCalendarModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-amber-600 text-white text-xs font-bold">Save Day Status</button>
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
                <button
                  onClick={() => setShowFullDetailsModal(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
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

                  {/* Leave Requests History */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400" /> Leave Requests History ({selectedUserFullDetails.leave_requests?.length})
                    </h4>
                    {selectedUserFullDetails.leave_requests?.length === 0 ? (
                      <p className="text-slate-500 py-2">No leave requests found.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {selectedUserFullDetails.leave_requests.map((l) => (
                          <div key={l.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-white">{l.from_date} to {l.to_date} {l.half_day && '(Half Day)'}</p>
                              <p className="text-[10px] text-slate-400">Reason: {l.reason}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              l.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                              l.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {l.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attendance Punches History */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400" /> Attendance Punch Records ({selectedUserFullDetails.punches?.length})
                    </h4>
                    {selectedUserFullDetails.punches?.length === 0 ? (
                      <p className="text-slate-500 py-2">No punch records found.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {selectedUserFullDetails.punches.map((p) => (
                          <div key={p.id} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between font-mono">
                            <div>
                              <span className="font-bold text-white">{p.day}</span> - {new Date(p.claimed_at).toLocaleTimeString()} ({p.work_mode})
                            </div>
                            <span className="text-[10px] text-slate-400">{p.device_type} ({p.ip})</span>
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
      </div>
    </main>
  );
}
