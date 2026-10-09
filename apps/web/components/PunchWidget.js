'use client';

import { useState, useEffect } from 'react';
import { LogIn, LogOut, Clock, MapPin, Monitor, ShieldCheck, AlertCircle } from 'lucide-react';

export default function PunchWidget({ onPunchSuccess }) {
  const [punchType, setPunchType] = useState('in');
  const [workMode, setWorkMode] = useState('office');
  const [claimedTime, setClaimedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Set default claimed time to current local time in YYYY-MM-DDTHH:mm format
  useEffect(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setClaimedTime(localISOTime);
  }, []);

  const handlePunchSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const payload = {
        punch_type: punchType,
        claimed_at: new Date(claimedTime).toISOString(),
        work_mode: workMode,
      };

      const res = await fetch('/api/attendance/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Punch recording failed');
      }

      setSuccessMsg(`Punch ${punchType.toUpperCase()} recorded successfully! Gap: ${data.gap_minutes}m. Device: ${data.device_type} (${data.os_name})`);
      if (onPunchSuccess) onPunchSuccess(data);
    } catch (err) {
      setError(err.message || 'Failed to submit punch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-800 space-y-4 sm:space-y-6 glow-blue">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-400 shrink-0" /> Attendance Punch Clock
          </h2>
          <p className="text-xs text-slate-400 mt-1">Dual-timestamp tamper-proof logger with server-side UA capture.</p>
        </div>
        <span className="px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30 shrink-0">
          Immutable Mode
        </span>
      </div>

      {error && (
        <div className="p-3 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handlePunchSubmit} className="space-y-4 sm:space-y-6">
        {/* Punch Type Selector */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setPunchType('in')}
            className={`py-3 sm:py-4 rounded-xl sm:rounded-2xl border text-xs sm:text-base font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
              punchType === 'in'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 glow-emerald'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <LogIn className="w-4 h-4 sm:w-5 sm:h-5" /> PUNCH IN
          </button>

          <button
            type="button"
            onClick={() => setPunchType('out')}
            className={`py-3 sm:py-4 rounded-xl sm:rounded-2xl border text-xs sm:text-base font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
              punchType === 'out'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 glow-blue'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" /> PUNCH OUT
          </button>
        </div>

        {/* Claimed Time Input */}
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[11px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider">Claimed Punch Time</label>
          <input
            type="datetime-local"
            required
            value={claimedTime}
            onChange={(e) => setClaimedTime(e.target.value)}
            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500 transition-all text-xs sm:text-sm font-mono"
          />
        </div>

        {/* Work Mode Selector */}
        <div className="space-y-1.5 sm:space-y-2">
          <label className="text-[11px] sm:text-xs font-semibold text-slate-300 uppercase tracking-wider">Work Mode</label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            {[
              { id: 'office', label: 'Office', icon: MapPin },
              { id: 'wfh', label: 'WFH', icon: Monitor },
              { id: 'half', label: 'Half Day', icon: Clock },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setWorkMode(mode.id)}
                className={`py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-2 transition-all ${
                  workMode === mode.id
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <mode.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-xl font-extrabold text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
            punchType === 'in'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/25'
              : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/25'
          }`}
        >
          {loading ? (
            <span>Recording Punch...</span>
          ) : (
            <span>SUBMIT PUNCH {punchType.toUpperCase()}</span>
          )}
        </button>
      </form>
    </div>
  );
}
