'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle, RefreshCw, Users, Check, X, Award, Sparkles, Plus } from 'lucide-react';

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [dailySummary, setDailySummary] = useState({});
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [fetching, setFetching] = useState(true);

  // Holiday Modal State
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayDate, setHolidayDate] = useState(new Date().toISOString().slice(0, 10));
  const [holidayLabel, setHolidayLabel] = useState('');

  const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const fetchCalendarData = async () => {
    setFetching(true);
    try {
      // 1. Fetch system calendar days for month
      const daysRes = await fetch(`/api/calendar/days?month=${monthStr}`);
      if (daysRes.ok) setCalendarDays(await daysRes.json());

      // 2. Fetch day statuses
      const targetUser = selectedUserId || user?.id;
      if (targetUser) {
        const statusRes = await fetch(
          selectedUserId && (user?.role === 'md' || user?.role === 'admin')
            ? `/api/calendar/users/${selectedUserId}?month=${monthStr}`
            : `/api/calendar/me?month=${monthStr}`
        );
        if (statusRes.ok) setMyStatuses(await statusRes.json());
      }

      // 3. If MD or Admin, fetch daily summary stats & pending leaves queue
      if (user?.role === 'md' || user?.role === 'admin') {
        const sumRes = await fetch(`/api/calendar/daily-summary?month=${monthStr}`);
        if (sumRes.ok) setDailySummary(await sumRes.json());

        const leaveRes = await fetch('/api/leave/pending');
        if (leaveRes.ok) setPendingLeaves(await leaveRes.json());

        const empRes = await fetch('/api/users');
        if (empRes.ok) setEmployees(await empRes.json());
      }

    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else fetchCalendarData();
    }
  }, [loading, user, monthStr, selectedUserId, router]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleApproveLeave = async (leaveId) => {
    try {
      const res = await fetch(`/api/leave/${leaveId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Approved via Company Calendar view' }),
      });
      if (res.ok) {
        alert('Leave request approved! Calendar updated.');
        fetchCalendarData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerAutomarker = async () => {
    try {
      const targetDate = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/calendar/admin/jobs/mark-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: targetDate }),
      });
      if (res.ok) {
        alert(`Auto-marker job executed successfully for ${targetDate}!`);
        fetchCalendarData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to run auto-marker job');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeclareHoliday = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/calendar/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: holidayDate,
          day_type: 'holiday',
          label: holidayLabel || 'Company Holiday',
        }),
      });
      if (res.ok) {
        alert(`Company Holiday declared for ${holidayDate}!`);
        setShowHolidayModal(false);
        setHolidayLabel('');
        fetchCalendarData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to declare holiday');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return null;

  // Build month calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const getStatusForDate = (dateStr) => {
    return myStatuses.find((s) => s.date === dateStr);
  };

  const getDayTypeForDate = (dateStr) => {
    return calendarDays.find((d) => d.date === dateStr);
  };

  const getPendingLeaveForDate = (dateStr) => {
    return pendingLeaves.find((l) => l.from_date <= dateStr && l.to_date >= dateStr);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] text-white pb-12">
      <Header />

      <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-10 space-y-6 sm:space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-emerald-900/40">
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" /> Attendance & Company Calendar
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">Monthly calendar view with automated attendance resolution & company holiday management.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            {(user?.role === 'admin' || user?.role === 'md') && employees.length > 0 && (
              <div className="flex items-center gap-2 bg-[#03140d] px-3 py-2 rounded-xl border border-emerald-900/60 text-xs w-full sm:w-auto">
                <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="bg-transparent text-white focus:outline-none text-xs font-bold w-full"
                >
                  <option value="" className="bg-[#03140d] text-white">My Own Calendar</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-[#03140d] text-white">
                      {emp.full_name} ({emp.role_name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(user?.role === 'admin' || user?.role === 'md') && (
              <>
                <button
                  onClick={() => setShowHolidayModal(true)}
                  className="px-3 sm:px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Declare Company Holiday
                </button>

                <button
                  onClick={handleTriggerAutomarker}
                  className="px-3 sm:px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> Run Auto-Marker Job
                </button>
              </>
            )}
          </div>
        </div>

        {/* Pending Leaves Banner for MD/Admin */}
        {(user?.role === 'md' || user?.role === 'admin') && pendingLeaves.length > 0 && (
          <div className="glass-card p-3 sm:p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-2">
            <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> Pending Leave Requests ({pendingLeaves.length}) - Click Approve to update calendar
            </h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {pendingLeaves.map((l) => (
                <div key={l.id} className="px-2.5 py-1.5 rounded-xl bg-[#03140d] border border-emerald-900/50 text-xs flex items-center gap-2 sm:gap-3">
                  <span><strong className="text-white">{l.user_full_name}</strong> ({l.from_date} to {l.to_date})</span>
                  <button
                    onClick={() => handleApproveLeave(l.id)}
                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Month Selector Bar */}
        <div className="flex items-center justify-between glass-card p-3 sm:p-4 rounded-2xl border border-emerald-900/40">
          <button onClick={handlePrevMonth} className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/60 text-slate-300 hover:text-white">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <h2 className="text-base sm:text-xl font-bold text-white font-mono uppercase tracking-wider">
            {currentDate.toLocaleString('default', { month: 'long' })} {year}
          </h2>

          <button onClick={handleNextMonth} className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/60 text-slate-300 hover:text-white">
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Legend Chips */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-[10px] sm:text-xs font-semibold">
          <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400" /> Present
          </span>
          <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-pulse" /> OT
          </span>
          <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-400" /> Leave
          </span>
          <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-400" /> WFH
          </span>
          <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400" /> Half Day
          </span>
          <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400" /> Holiday
          </span>
          <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-400" /> Absent
          </span>
        </div>

        {/* Calendar Month Grid */}
        <div className="glass-card p-2 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-emerald-900/40 space-y-2 sm:space-y-4">
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-extrabold uppercase text-slate-400 pb-2 sm:pb-3 border-b border-emerald-900/40">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Date Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Empty slots for month start padding */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="h-16 sm:h-28 rounded-xl sm:rounded-2xl bg-slate-950/40 border border-emerald-950/40 opacity-30" />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const statusObj = getStatusForDate(dateStr);
              const dayTypeObj = getDayTypeForDate(dateStr);
              const pendingLeaveObj = getPendingLeaveForDate(dateStr);
              const dayStatSummary = dailySummary[dateStr];

              const st = statusObj?.status || dayTypeObj?.day_type || 'working';

              return (
                <div
                  key={dateStr}
                  className={`h-20 sm:h-28 p-1 sm:p-3 rounded-xl sm:rounded-2xl border flex flex-col justify-between transition-all ${
                    st === 'present' ? 'bg-emerald-500/10 border-emerald-500/30' :
                    st === 'ot' ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-md shadow-amber-500/10' :
                    st === 'leave' ? 'bg-indigo-500/10 border-indigo-500/30' :
                    st === 'wfh' ? 'bg-sky-500/10 border-sky-500/30' :
                    st === 'half' ? 'bg-amber-500/10 border-amber-500/30' :
                    st === 'holiday' ? 'bg-purple-500/10 border-purple-500/30' :
                    st === 'absent' ? 'bg-rose-500/10 border-rose-500/30' :
                    st === 'weekend' ? 'bg-[#03140d]/60 border-emerald-900/40 text-slate-500' :
                    'bg-[#03140d]/40 border-emerald-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-xs sm:text-sm">{dayNum}</span>
                    {dayTypeObj?.label && <span className="text-[8px] sm:text-[9px] font-bold text-purple-300 truncate max-w-[40px] sm:max-w-[70px]">{dayTypeObj.label}</span>}
                  </div>

                  {/* Daily Presence/Absent/Leave stats summary for MD/Admin */}
                  {(user?.role === 'md' || user?.role === 'admin') && dayStatSummary && (
                    <div className="flex flex-wrap gap-0.5 sm:gap-1 text-[8px] sm:text-[9px] font-mono font-bold">
                      <span className="text-emerald-400">{dayStatSummary.present || 0}P</span>
                      <span className="text-rose-400">{dayStatSummary.absent || 0}A</span>
                      <span className="text-indigo-400">{dayStatSummary.leave || 0}L</span>
                    </div>
                  )}

                  {pendingLeaveObj && st !== 'leave' && (
                    <div className="my-auto hidden sm:block">
                      <span className="px-1 py-0.5 text-[8px] sm:text-[9px] font-bold rounded bg-amber-500/30 text-amber-200 border border-amber-500/40 block truncate" title={`Pending Leave: ${pendingLeaveObj.user_full_name}`}>
                        Pending Leave
                      </span>
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between">
                    <span className={`px-1 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-extrabold uppercase rounded ${
                      st === 'present' ? 'bg-emerald-500/20 text-emerald-300' :
                      st === 'ot' ? 'bg-amber-400/30 text-amber-200 border border-amber-400/50 shadow' :
                      st === 'leave' ? 'bg-indigo-500/20 text-indigo-300' :
                      st === 'wfh' ? 'bg-sky-500/20 text-sky-300' :
                      st === 'half' ? 'bg-amber-500/20 text-amber-300' :
                      st === 'holiday' ? 'bg-purple-500/20 text-purple-300' :
                      st === 'absent' ? 'bg-rose-500/20 text-rose-300' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {st}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Declare Company Holiday Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-8 rounded-3xl border border-emerald-900/50 w-full max-w-md space-y-6">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" /> Declare Company Holiday
              </h3>
              <button onClick={() => setShowHolidayModal(false)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeclareHoliday} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Holiday Date</label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Holiday Name / Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali, Pongal, Founders Day"
                  value={holidayLabel}
                  onChange={(e) => setHolidayLabel(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowHolidayModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancel</button>
                <button type="submit" className="w-1/2 py-3 rounded-xl bg-purple-600 text-white font-bold">Declare Holiday</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
