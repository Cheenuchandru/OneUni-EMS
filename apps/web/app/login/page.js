'use client';

import { useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Logo from '../../components/Logo';
import { Lock, Mail, ShieldAlert, ArrowRight, Key, X, CheckCircle, RefreshCw } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // Forgot Password & OTP State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: send OTP, 2: reset pass
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotErr, setForgotErr] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [simulatedOtp, setSimulatedOtp] = useState('');

  // Mandatory First Login Password Change State
  const [mustChangePassModal, setMustChangePassModal] = useState(false);
  const [firstNewPassword, setFirstNewPassword] = useState('');
  const [firstConfirmPassword, setFirstConfirmPassword] = useState('');
  const [mustChangePassErr, setMustChangePassErr] = useState('');
  const [mustChangePassLoading, setMustChangePassLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userObj = await login(email, password);
      
      // If temporary / initial password flag is active, force password change modal
      if (userObj?.must_change_password) {
        setLoggedInUser(userObj);
        setMustChangePassModal(true);
        return;
      }

      if (userObj?.role === 'admin') router.push('/admin');
      else if (userObj?.role === 'md') router.push('/md');
      else router.push('/dashboard');

    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFirstPasswordChange = async (e) => {
    e.preventDefault();
    setMustChangePassErr('');
    if (firstNewPassword.length < 6) {
      setMustChangePassErr('Password must be at least 6 characters long.');
      return;
    }
    if (firstNewPassword !== firstConfirmPassword) {
      setMustChangePassErr('Passwords do not match. Please try again.');
      return;
    }

    setMustChangePassLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: firstNewPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to update password');
      }

      alert('Password updated successfully! Redirecting to workspace...');
      setMustChangePassModal(false);
      
      const role = loggedInUser?.role;
      if (role === 'admin') router.push('/admin');
      else if (role === 'md') router.push('/md');
      else router.push('/dashboard');

    } catch (err) {
      setMustChangePassErr(err.message);
    } finally {
      setMustChangePassLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to send OTP code.');
      }
      setForgotMsg('OTP code sent to your registered email address!');
      if (json.otp_code) setSimulatedOtp(json.otp_code);
      setForgotStep(2);
    } catch (err) {
      setForgotErr(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotErr('');
    setForgotMsg('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          otp_code: otpCode,
          new_password: newPassword
        })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to reset password.');
      }
      setForgotMsg('Password updated successfully! You can now log in.');
      setTimeout(() => {
        setShowForgotModal(false);
        setEmail(forgotEmail);
        setPassword('');
        setForgotStep(1);
      }, 2000);
    } catch (err) {
      setForgotErr(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative flex items-center justify-center bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] p-4 sm:p-6">
      {/* Background Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[550px] h-[300px] sm:h-[550px] bg-emerald-500/10 rounded-full blur-[100px] sm:blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4 sm:space-y-6">
        <div className="glass-card p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-emerald-900/50 shadow-2xl space-y-6 sm:space-y-8 glow-emerald">
          {/* Header & OneUni Logo */}
          <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3">
            <Logo size="lg" showSubtitle={false} href="/" />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">OneUni Workspace Portal</h1>
              <p className="text-xs text-emerald-400 font-semibold mt-0.5">Oneuni Agri Platform Pvt Ltd</p>
              <p className="text-[11px] text-slate-400">The company behind Agri.in, Milk.in & TheOrganic.in</p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.local"
                  className="w-full pl-11 pr-4 py-3 bg-[#03140d]/90 border border-emerald-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotErr('');
                    setForgotMsg('');
                    setForgotStep(1);
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-[#03140d]/90 border border-emerald-900/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Preset Logins */}
          <div className="pt-2 border-t border-emerald-900/40 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 text-center">1-Click Quick Demo Sign In</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setEmail('sarah@company.com'); setPassword('Employee123!'); }}
                className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/60 hover:border-emerald-500 text-[11px] font-bold text-emerald-300 text-center transition-colors"
              >
                Employee
              </button>
              <button
                type="button"
                onClick={() => { setEmail('md@company.com'); setPassword('MDPassword123!'); }}
                className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/60 hover:border-teal-500 text-[11px] font-bold text-teal-300 text-center transition-colors"
              >
                MD Portal
              </button>
              <button
                type="button"
                onClick={() => { setEmail('admin@company.com'); setPassword('AdminPassword123!'); }}
                className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/60 hover:border-amber-500 text-[11px] font-bold text-amber-300 text-center transition-colors"
              >
                Admin
              </button>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center space-y-1">
            <p className="text-xs text-slate-400">
              Protected by sliding rate limits & SHA-256 pre-hashed security.
            </p>
            <p className="text-[10px] text-emerald-500/80 font-medium">
              © Oneuni Agri Platform Pvt Ltd · Salem, Tamil Nadu
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password OTP Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-3xl border border-emerald-800/50 w-full max-w-md space-y-5 shadow-2xl bg-[#051a14]/95 text-white">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold">Reset Password via OTP</h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-emerald-900/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotErr && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{forgotErr}</span>
              </div>
            )}

            {forgotMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{forgotMsg}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Registered Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {forgotLoading ? 'Sending OTP...' : 'Send 6-Digit OTP Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {simulatedOtp && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center">
                    <span className="font-bold">Simulated OTP Code:</span> <span className="font-mono text-sm tracking-widest bg-amber-950 px-2 py-0.5 rounded">{simulatedOtp}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">6-Digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {forgotLoading ? 'Updating Password...' : 'Verify OTP & Reset Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Mandatory First-Time Password Reset Modal */}
      {mustChangePassModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-amber-500/40 w-full max-w-md space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">First Login: Password Reset Required</h3>
                <p className="text-xs text-amber-400 font-medium">Account setup complete — Set your permanent password</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You logged in using an initial/temporary password. For security compliance, please set your confidential permanent password below.
            </p>

            {mustChangePassErr && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{mustChangePassErr}</span>
              </div>
            )}

            <form onSubmit={handleFirstPasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Permanent Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password (min 6 characters)..."
                  value={firstNewPassword}
                  onChange={(e) => setFirstNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password..."
                  value={firstConfirmPassword}
                  onChange={(e) => setFirstConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={mustChangePassLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                {mustChangePassLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Set New Password & Access Workspace'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
