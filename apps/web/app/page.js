'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '../components/Logo';
import Footer from '../components/Footer';
import {
  ShieldCheck, Activity, Server, Cpu, Mail, Calendar, CheckCircle2,
  Clock, Users, Database, LogIn, ArrowRight, Sparkles, Layers,
  FileText, FolderKanban, Bell, Shield, ExternalLink, Award, Sprout
} from 'lucide-react';

export default function Home() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [quickLoginLoading, setQuickLoginLoading] = useState(null);

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') router.push('/admin');
      else if (user.role === 'md') router.push('/md');
      else router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleQuickLogin = async (email, password, role) => {
    setQuickLoginLoading(role);
    try {
      await login(email, password);
      if (role === 'admin') router.push('/admin');
      else if (role === 'md') router.push('/md');
      else router.push('/dashboard');
    } catch (err) {
      console.error(err);
      alert(`Login failed: ${err.message}`);
    } finally {
      setQuickLoginLoading(null);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d]">
      {/* Background Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-3/4 right-10 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />

      <main className="p-6 lg:p-12 relative z-10">
        <div className="max-w-7xl mx-auto space-y-12">
          {/* Header Navigation */}
          <header className="flex items-center justify-between pb-6 border-b border-emerald-900/40">
            <Logo size="md" showSubtitle={true} href="/" />

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Sign In
              </Link>
            </div>
          </header>

          {/* Hero Section */}
          <section className="text-center space-y-6 max-w-4xl mx-auto pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-pill border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <Award className="w-4 h-4 text-amber-400" /> Oneuni Agri Platform Pvt Ltd · DPIIT-Recognised Startup
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
              OneUni Employee Workspace & <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                Agri Time-Office Portal
              </span>
            </h1>

            <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Internal Employee Management System for <strong className="text-white">Oneuni Agri Platform Pvt Ltd</strong> — the company behind <strong className="text-emerald-400">Agri.in</strong>, <strong className="text-emerald-400">Milk.in</strong>, and <strong className="text-emerald-400">TheOrganic.in</strong>.
            </p>

            {/* Quick Demo Login Cards */}
            <div className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4">1-Click Quick Demo Workspace Access</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <button
                  onClick={() => handleQuickLogin('sarah@company.com', 'Employee123!', 'employee')}
                  disabled={!!quickLoginLoading}
                  className="glass-card p-5 rounded-2xl border border-emerald-900/40 hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Employee Portal</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="font-bold text-white text-sm">Sarah Jenkins</p>
                  <p className="text-xs text-slate-400 mt-1">Punch widget, EOD editor, My tasks, Leave apply</p>
                </button>

                <button
                  onClick={() => handleQuickLogin('md@company.com', 'MDPassword123!', 'md')}
                  disabled={!!quickLoginLoading}
                  className="glass-card p-5 rounded-2xl border border-emerald-900/40 hover:border-teal-500/60 hover:bg-teal-500/10 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">MD Executive</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="font-bold text-white text-sm">Managing Director</p>
                  <p className="text-xs text-slate-400 mt-1">Live punch feed, gap flags, leave approvals, EODs</p>
                </button>

                <button
                  onClick={() => handleQuickLogin('admin@company.com', 'AdminPassword123!', 'admin')}
                  disabled={!!quickLoginLoading}
                  className="glass-card p-5 rounded-2xl border border-emerald-900/40 hover:border-amber-500/60 hover:bg-amber-500/10 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">System Admin</span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="font-bold text-white text-sm">System Admin</p>
                  <p className="text-xs text-slate-400 mt-1">Role builder, users CRUD, audit logs, mail rules</p>
                </button>
              </div>
            </div>
          </section>

          {/* OneUni Company Showcase */}
          <section className="glass-card p-8 rounded-3xl border border-emerald-900/50 space-y-6">
            <div className="flex items-center justify-between border-b border-emerald-900/40 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Sprout className="w-6 h-6 text-emerald-400" /> Oneuni Agri Platform Pvt Ltd Ecosystem
                </h3>
                <p className="text-xs text-slate-400 mt-1">Unified neutral discovery platforms built for Indian agriculture from Salem, Tamil Nadu</p>
              </div>
              <a href="https://oneuni.in/" target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors">
                Visit Official Website <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#03140d] border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-300 text-sm">Agri.in</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">Super App</span>
                </div>
                <p className="text-xs text-slate-400">One place for everything Indian agriculture needs — farmers, FPOs, dealers, and buyers.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#03140d] border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sky-300 text-sm">Milk.in</span>
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-bold">Hyperlocal</span>
                </div>
                <p className="text-xs text-slate-400">Hyperlocal discovery of dairy farms, milk vendors and doorstep suppliers by pincode.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#03140d] border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-teal-300 text-sm">TheOrganic.in</span>
                  <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-bold">Verified</span>
                </div>
                <p className="text-xs text-slate-400">Certified organic farms, stores, brands and products listed by location.</p>
              </div>

              <div className="p-4 rounded-2xl bg-[#03140d] border border-emerald-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-300 text-sm">AgriID & AgriCoins</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">Rewards</span>
                </div>
                <p className="text-xs text-slate-400">One login identity across all platforms with genuine closed-loop loyalty rewards.</p>
              </div>
            </div>
          </section>

          {/* Workspace Feature Navigation Modules */}
          <section className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" /> Interactive Workspace Modules
              </h2>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> All 14 Days Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/dashboard" className="glass-card p-6 rounded-2xl border border-emerald-900/40 hover:border-emerald-500/50 transition-all space-y-3 group">
                <div className="p-3 w-fit bg-emerald-500/10 rounded-xl text-emerald-400">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">Employee Portal & Punch Clock</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tamper-proof attendance punch IN/OUT with claimed vs server timestamps, work mode selector, and personal activity log.
                </p>
              </Link>

              <Link href="/leave" className="glass-card p-6 rounded-2xl border border-emerald-900/40 hover:border-teal-500/50 transition-all space-y-3 group">
                <div className="p-3 w-fit bg-teal-500/10 rounded-xl text-teal-400">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-teal-400 transition-colors">Leave Application & Balances</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Self-service leave requests with overlap validation, 18 days/yr balance counter, and approval workflow.
                </p>
              </Link>

              <Link href="/eod" className="glass-card p-6 rounded-2xl border border-emerald-900/40 hover:border-amber-500/50 transition-all space-y-3 group">
                <div className="p-3 w-fit bg-amber-500/10 rounded-xl text-amber-400">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">EOD Markdown Reports</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Admin-managed markdown templates with pre-filled sections, preview toggle, and automatic midnight locking.
                </p>
              </Link>

              <Link href="/projects" className="glass-card p-6 rounded-2xl border border-emerald-900/40 hover:border-emerald-500/50 transition-all space-y-3 group">
                <div className="p-3 w-fit bg-emerald-500/10 rounded-xl text-emerald-400">
                  <FolderKanban className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">Project & Task Management</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kanban-style project board, task assignments, assignee status updates, and status timeline auditing.
                </p>
              </Link>

              <Link href="/announcements" className="glass-card p-6 rounded-2xl border border-emerald-900/40 hover:border-purple-500/50 transition-all space-y-3 group">
                <div className="p-3 w-fit bg-purple-500/10 rounded-xl text-purple-400">
                  <Bell className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">Announcements & Comments</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Company-wide pinned announcements, in-app notification bell, and project/task comment threads.
                </p>
              </Link>

              <Link href="/admin" className="glass-card p-6 rounded-2xl border border-emerald-900/40 hover:border-rose-500/50 transition-all space-y-3 group">
                <div className="p-3 w-fit bg-rose-500/10 rounded-xl text-rose-400">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-rose-400 transition-colors">Admin Master Control & Audit</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Role builder, permission matrix, user management, Gmail mail routing rules, and DB-level immutable audit log.
                </p>
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
