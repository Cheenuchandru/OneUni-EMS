'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import { Bell, Pin, Plus, ArrowLeft, CheckCircle2 } from 'lucide-react';


export default function AnnouncementsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [announcements, setAnnouncements] = useState([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [title, setTitle] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [pinned, setPinned] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const json = await res.json();
        setAnnouncements(json);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else fetchAnnouncements();
    }
  }, [loading, user, router]);

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body_md: bodyMd, pinned }),
      });
      if (res.ok) {
        setShowPostModal(false);
        setTitle('');
        setBodyMd('');
        setPinned(false);
        fetchAnnouncements();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to post announcement');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#090d16] text-slate-400">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 animate-spin text-purple-400" />
          <span>Loading Announcements...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#090d16] pb-12">
      <Header />
      <div className="max-w-5xl mx-auto p-6 lg:p-12 space-y-8">



        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Bell className="w-8 h-8 text-purple-400" /> Company Announcements
            </h1>
            <p className="text-slate-400 text-sm mt-1">Official management updates and organization-wide news.</p>
          </div>

          {(user?.role === 'admin' || user?.role === 'md') && (
            <button
              onClick={() => setShowPostModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Post Announcement
            </button>
          )}
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <p className="text-sm text-slate-500 py-12 text-center">No announcements posted yet.</p>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className={`glass-card p-6 rounded-3xl border transition-all space-y-3 ${
                  a.pinned ? 'border-purple-500/40 bg-purple-500/5 glow-purple' : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {a.pinned && (
                      <span className="px-2.5 py-0.5 text-xs font-extrabold uppercase rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    )}
                    <h2 className="text-lg font-bold text-white">{a.title}</h2>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{a.body_md}</p>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Posted by: <strong className="text-slate-300">{a.author_name}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Post Modal */}
        {showPostModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card p-8 rounded-3xl border border-slate-800 w-full max-w-lg space-y-6">
              <h3 className="text-xl font-bold text-white">Post Official Announcement</h3>
              <form onSubmit={handlePostAnnouncement} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder="Announcement Title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm"
                />
                <textarea
                  rows={6}
                  required
                  placeholder="Announcement Body (Markdown supported)..."
                  value={bodyMd}
                  onChange={(e) => setBodyMd(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm font-mono"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pinToggle"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-500"
                  />
                  <label htmlFor="pinToggle" className="text-sm text-slate-300 font-medium">Pin to top of feed</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPostModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-purple-600 text-white text-xs font-bold">Publish Announcement</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
