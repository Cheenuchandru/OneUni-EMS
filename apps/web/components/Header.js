'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from './Logo';
import {
  Activity, Clock, Calendar, FileText, FolderKanban, Bell, Shield,
  LogOut, Download, AlertTriangle, ArrowRight, ShieldCheck, Layers, Users, Key, Mail, Megaphone, MoreVertical, StickyNote, Plus, Trash2, X, MessageSquare, Menu
} from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Quick Notes Tab State (User Isolated)
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');

  const notesKey = user ? `oneuni_notes_${user.id || user.email}` : null;

  const fetchApiNotes = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notes?scope=all');
      if (res.ok) {
        const data = await res.json();
        setNotes(data.map(n => ({
          id: n.id,
          text: n.title,
          subtext: n.bug_description || n.resolution_method || '',
          scope: n.scope,
          category: n.category,
          date: new Date(n.created_at).toLocaleDateString()
        })));
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (user) fetchApiNotes();
  }, [user]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newNoteText.trim(),
          scope: 'individual',
          category: 'feature_note'
        })
      });
      if (res.ok) {
        setNewNoteText('');
        fetchApiNotes();
      }
    } catch (e) {}
  };

  const handleDeleteNote = async (id) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) fetchApiNotes();
    } catch (e) {}
  };

  // EOD Logout Enforcement Modal (Employee Only)
  const [showEODBlockModal, setShowEODBlockModal] = useState(false);
  const [checkingLogout, setCheckingLogout] = useState(false);

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        setNotifications(json);
        setUnreadCount(json.filter((n) => !n.read_at).length);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchChatUnread = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/chat/unread');
      if (res.ok) {
        const data = await res.json();
        setUnreadChatCount(data.total_unread || 0);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchNotifications();
    fetchChatUnread();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchChatUnread();
    }, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkRead = async (notifId) => {
    try {
      const res = await fetch(`/api/notifications/${notifId}/read`, { method: 'POST' });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mandatory EOD Enforcement on Logout (Employee Only)
  const handleLogoutClick = async () => {
    if (!user) return;
    
    // MD & Admin roles bypass
    if (user.role === 'admin' || user.role === 'md') {
      logout();
      return;
    }

    setCheckingLogout(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Check if punched IN today
      const pRes = await fetch('/api/attendance/me');
      if (pRes.ok) {
        const punches = await pRes.json();
        const punchedInToday = punches.some(p => p.day === todayStr && p.punch_type === 'in');

        if (punchedInToday) {
          // Check if EOD submitted today
          const eodRes = await fetch('/api/eod/me');
          if (eodRes.ok) {
            const eods = await eodRes.json();
            const eodSubmittedToday = eods.some(e => e.date === todayStr);

            if (!eodSubmittedToday) {
              setShowEODBlockModal(true);
              setCheckingLogout(false);
              return;
            }
          }
        }
      }
      
      logout();
    } catch (err) {
      console.error(err);
      logout();
    } finally {
      setCheckingLogout(false);
    }
  };

  if (!user) return null;

  // Role-Scoped Navigation Headers
  let navLinks = [];

  if (user.role === 'employee') {
    navLinks = [
      { name: 'My Dashboard', href: '/dashboard', icon: Activity },
      { name: 'Team Chat', href: '/chat', icon: MessageSquare },
      { name: 'EOD Report', href: '/eod', icon: FileText },
      { name: 'Activity Log', href: '/activity', icon: Shield },
      { name: 'Apply Leave', href: '/leave', icon: Calendar },
      { name: 'My Tasks', href: '/projects', icon: FolderKanban },
      { name: 'My Calendar', href: '/calendar', icon: Calendar },
    ];
  } else if (user.role === 'md') {
    navLinks = [
      { name: 'My Dashboard', href: '/md', icon: Layers },
      { name: 'Team Chat', href: '/chat', icon: MessageSquare },
      { name: 'Team EOD', href: '/eod', icon: FileText },
      { name: 'Projects Board', href: '/projects', icon: FolderKanban },
      { name: 'Company Calendar', href: '/calendar', icon: Calendar },
      { name: 'Activity Log', href: '/activity', icon: Shield },
    ];
  } else if (user.role === 'admin') {
    navLinks = [
      { name: 'Admin Control', href: '/admin', icon: Shield },
      { name: 'Team Chat', href: '/chat', icon: MessageSquare },
      { name: 'Projects Board', href: '/projects', icon: FolderKanban },
      { name: 'Company Calendar', href: '/calendar', icon: Calendar },
      { name: 'Announcements', href: '/announcements', icon: Megaphone },
      { name: 'Activity Log', href: '/activity', icon: Shield },
    ];
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[#051812]/90 backdrop-blur-xl border-b border-emerald-900/40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* OneUni Logo & Subtitle */}
        <Logo size="md" showSubtitle={true} href="/" />

        {/* Center Role-Scoped Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-[#03110d]/90 p-1.5 rounded-full border border-emerald-900/50">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap relative ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-emerald-900/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{link.name}</span>
                {link.href === '/chat' && unreadChatCount > 0 && (
                  <span className="relative flex h-2 w-2 ml-0.5" title={`${unreadChatCount} unread message(s)`}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>


        {/* Right Action Icons & Mobile Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Sticky Notes Button with Dropdown Popover */}
          <div className="relative">
            <button
              onClick={() => setShowNotesModal(!showNotesModal)}
              className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/60 text-emerald-400 hover:text-emerald-300 transition-colors relative"
              title="My Quick Sticky Notes"
            >
              <StickyNote className="w-4 h-4" />
              {notes.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">
                  {notes.length}
                </span>
              )}
            </button>

            {showNotesModal && (
              <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-96 glass-card p-4 rounded-2xl border border-emerald-700/60 shadow-2xl z-50 space-y-3 bg-[#041a13]/98 text-white max-w-sm sm:max-w-none mx-auto sm:mx-0">
                <div className="flex items-center justify-between border-b border-emerald-900/80 pb-2">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">My Sticky Notes ({notes.length})</span>
                  </div>
                  <button
                    onClick={() => setShowNotesModal(false)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a quick reminder..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#02100b] border border-emerald-800/70 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </form>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {notes.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center italic">No quick notes saved. Add one above!</p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-xl bg-[#02140d] border border-emerald-800/60 flex items-start justify-between gap-2 group"
                      >
                        <div className="space-y-1 flex-1">
                          <p className="text-xs text-slate-100 font-medium leading-snug">{note.text}</p>
                          <span className="text-[10px] text-amber-300 font-mono block font-bold">{note.date}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 opacity-80 group-hover:opacity-100 transition-opacity"
                          title="Delete Note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-emerald-900/60 text-center">
                  <Link
                    href="/notes"
                    onClick={() => setShowNotesModal(false)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-400 hover:text-emerald-300 transition-colors w-full py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-900/50"
                  >
                    Open Knowledge & Bug Resolution Hub <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Announcements Quick Link Icon */}
          <Link
            href="/announcements"
            className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/60 text-slate-300 hover:text-amber-400 transition-colors"
            title="View Company Announcements"
          >
            <Megaphone className="w-4 h-4" />
          </Link>

          {/* Mobile Navigation Menu Toggle */}
          <div className="relative md:hidden">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-xl bg-[#03140d] border border-emerald-900/70 text-emerald-400 hover:text-emerald-300 transition-colors"
              title="Navigation Menu"
            >
              {showMobileMenu ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {showMobileMenu && (
              <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-60 glass-card p-2 rounded-2xl border border-emerald-800/80 shadow-2xl z-50 space-y-1 bg-[#041a13]/98 text-white max-w-xs sm:max-w-none mx-auto sm:mx-0">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      onClick={() => setShowMobileMenu(false)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                          : 'text-slate-300 hover:bg-emerald-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-emerald-400" />
                        <span>{link.name}</span>
                      </div>
                      {link.href === '/chat' && unreadChatCount > 0 && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notification Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 glass-card p-4 rounded-2xl border border-slate-800 shadow-2xl z-50 space-y-3 bg-[#041a13]/98 text-white max-w-sm sm:max-w-none mx-auto sm:mx-0">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications ({notifications.length})</span>
                  <span className="text-[10px] text-sky-400 font-semibold">{unreadCount} unread</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No notifications.</p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-colors space-y-1 ${
                          n.read_at ? 'bg-slate-900/40 border-slate-800/60 text-slate-400' : 'bg-sky-500/10 border-sky-500/30 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase text-[10px] text-sky-400">{n.type}</span>
                          <span className="text-[10px] text-slate-500">{new Date(n.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-300">{n.payload?.title || n.payload?.message || JSON.stringify(n.payload)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <Link href="/me" className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-emerald-950/40 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold uppercase shadow-sm shadow-emerald-500/30 overflow-hidden shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                ) : (
                  user.full_name?.charAt(0)
                )}
              </div>
              <div className="text-left hidden lg:block">
                <p className="text-xs font-bold text-white leading-none">{user.full_name}</p>
                <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">{user.role}</p>
              </div>
            </Link>

            {/* Logout button (only kept for Admin role; for Employee and MD, logout is in Profile /me) */}
            {user.role === 'admin' && (
              <button
                onClick={handleLogoutClick}
                disabled={checkingLogout}
                className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory EOD Logout Enforcement Modal */}
      {showEODBlockModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-8 rounded-3xl border border-rose-500/30 w-full max-w-md space-y-6 text-center shadow-2xl">
            <div className="p-4 bg-rose-500/10 rounded-2xl text-rose-400 border border-rose-500/20 w-fit mx-auto animate-pulse">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">EOD Report Required Before Logout</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                You punched IN today, but have not submitted your End-of-Day (EOD) Report yet.
                Company policy requires submitting your daily report before logging out.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => {
                  setShowEODBlockModal(false);
                  router.push('/eod');
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
              >
                Go to EOD Editor Now <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowEODBlockModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
