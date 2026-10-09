'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import {
  StickyNote, Plus, Download, Search, Tag, Bug, Cpu, Layers, BookOpen,
  User, Users, Edit3, Trash2, X, Check, FileText, Sparkles, Filter, Lock, Unlock, ArrowDownToLine
} from 'lucide-react';

export default function KnowledgeNotesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [notes, setNotes] = useState([]);
  const [fetching, setFetching] = useState(true);

  // Filters
  const [activeScope, setActiveScope] = useState('all'); // 'all' | 'common' | 'individual'
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState('common');
  const [category, setCategory] = useState('bug_fix');
  const [bugDescription, setBugDescription] = useState('');
  const [resolutionMethod, setResolutionMethod] = useState('');
  const [techStack, setTechStack] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchNotes = async () => {
    setFetching(true);
    try {
      let url = `/api/notes?scope=${activeScope}`;
      if (activeCategory) url += `&category=${activeCategory}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
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
      else fetchNotes();
    }
  }, [loading, user, activeScope, activeCategory, searchQuery, router]);

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        title: title.trim(),
        scope,
        category,
        bug_description: bugDescription,
        resolution_method: resolutionMethod,
        tech_stack: techStack,
        tags
      };

      let res;
      if (editingNote) {
        res = await fetch(`/api/notes/${editingNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.detail || 'Failed to save note');
      }

      // Reset form
      setShowCreateModal(false);
      setEditingNote(null);
      resetForm();
      fetchNotes();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Are you sure you want to delete this lifetime note?')) return;
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchNotes();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to delete note');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEdit = (n) => {
    setEditingNote(n);
    setTitle(n.title);
    setScope(n.scope);
    setCategory(n.category);
    setBugDescription(n.bug_description || '');
    setResolutionMethod(n.resolution_method || '');
    setTechStack(n.tech_stack || '');
    setTags(n.tags || '');
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setTitle('');
    setScope('common');
    setCategory('bug_fix');
    setBugDescription('');
    setResolutionMethod('');
    setTechStack('');
    setTags('');
    setErrorMsg('');
  };

  const handleExport = (format) => {
    window.open(`/api/notes/export?format=${format}&scope=${activeScope}`, '_blank');
  };

  if (loading) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] text-white pb-12">
      <Header />

      <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-10 space-y-6">

        {/* Top Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-emerald-900/40">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Lifetime Knowledge Base & Bug Resolution Hub
            </span>
            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5 mt-0.5">
              <StickyNote className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" /> Resolution Notes & Tech Stack Log
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Record lifetime bug fixes, cleared issues, resolution methods, and tech stack notes. Export anytime.
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
            <button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Record New Lifetime Note
            </button>

            {/* Export Options */}
            <div className="flex items-center gap-1 bg-[#03140d] p-1 rounded-xl border border-emerald-900/60">
              <button
                onClick={() => handleExport('md')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1 transition-colors"
                title="Export as Markdown (.md)"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" /> .MD
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-xs font-bold flex items-center gap-1 transition-colors"
                title="Export as JSON (.json)"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" /> .JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors"
                title="Export as CSV (.csv)"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" /> .CSV
              </button>
            </div>
          </div>
        </div>

        {/* Scope Tabs & Category Filter Bar */}
        <div className="glass-card p-3 sm:p-4 rounded-2xl border border-emerald-900/40 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Scope Switcher Tabs */}
            <div className="flex items-center gap-1.5 bg-[#03110d] p-1 rounded-xl border border-emerald-900/60">
              <button
                onClick={() => setActiveScope('all')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeScope === 'all'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> All Notes
              </button>
              <button
                onClick={() => setActiveScope('common')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeScope === 'common'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-sky-400" /> Team Common
              </button>
              <button
                onClick={() => setActiveScope('individual')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeScope === 'individual'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5 text-amber-400" /> My Personal
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bugs, stack, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: '', label: 'All Categories', icon: Layers },
              { id: 'bug_fix', label: '🐛 Bug Fix & Cleared', icon: Bug },
              { id: 'tech_stack', label: '⚡ Tech Stack & Pattern', icon: Cpu },
              { id: 'feature_note', label: '🚀 Feature Note', icon: Sparkles },
              { id: 'architecture', label: '🏛️ Architecture', icon: Layers },
              { id: 'guide', label: '📘 Guide / SOP', icon: BookOpen },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  activeCategory === c.id
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-[#03140d]/60 border-emerald-900/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes Grid */}
        {fetching ? (
          <div className="glass-card p-12 text-center text-slate-400 text-sm">
            <span>Loading Knowledge Notes & Bug Log...</span>
          </div>
        ) : notes.length === 0 ? (
          <div className="glass-card p-12 rounded-3xl text-center space-y-3 border border-emerald-900/40">
            <StickyNote className="w-10 h-10 text-emerald-500/40 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Notes Recorded Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Start recording lifetime resolution notes for bugs cleared, stack methods used, and common engineering knowledge.
            </p>
            <button
              onClick={() => { resetForm(); setShowCreateModal(true); }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              + Create First Lifetime Note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notes.map((n) => (
              <div
                key={n.id}
                className="glass-card p-5 rounded-2xl border border-emerald-900/50 space-y-4 glow-emerald bg-[#03140f]/90 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Bar Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                        n.scope === 'common'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}>
                        {n.scope === 'common' ? '🌐 Team Common' : '🔒 Personal'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {n.category.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {(n.user_id === user.id || user.role === 'admin' || user.role === 'md') && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(n)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-emerald-300 transition-colors"
                            title="Edit Note"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Note"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-extrabold text-white leading-snug">{n.title}</h3>

                  {/* Author & Date */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      <User className="w-3 h-3 text-emerald-400" /> {n.author_name}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-slate-400">
                      {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Tech Stack & Tags */}
                  {(n.tech_stack || n.tags) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {n.tech_stack && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-mono font-bold flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-purple-400" /> {n.tech_stack}
                        </span>
                      )}
                      {n.tags && n.tags.split(',').map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono">
                          #{t.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bug Description Box */}
                  {n.bug_description && (
                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                        <Bug className="w-3.5 h-3.5 text-rose-400" /> Issue / Bug Encountered
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {n.bug_description}
                      </p>
                    </div>
                  )}

                  {/* Resolution Method Box */}
                  {n.resolution_method && (
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Cleared By Method / Stack Solution
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                        {n.resolution_method}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record / Edit Lifetime Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-emerald-800/60 w-full max-w-xl space-y-5 bg-[#051a14]/95 text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base sm:text-lg font-bold">
                  {editingNote ? 'Edit Lifetime Note' : 'Record Lifetime Knowledge & Bug Resolution Note'}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveNote} className="space-y-4 text-xs">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold uppercase tracking-wider">Note Title / Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js 15 Webpack Cache Mismatch & React 19 Hydration Fix"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Scope & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold uppercase tracking-wider">Scope (Visibility)</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 font-bold"
                  >
                    <option value="common" className="bg-[#03140d] text-white">🌐 Team Common (Shared Knowledge)</option>
                    <option value="individual" className="bg-[#03140d] text-white">🔒 Personal (My Private Note)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold uppercase tracking-wider">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="bug_fix" className="bg-[#03140d] text-white">🐛 Bug Fix & Resolution</option>
                    <option value="tech_stack" className="bg-[#03140d] text-white">⚡ Tech Stack & Method Pattern</option>
                    <option value="feature_note" className="bg-[#03140d] text-white">🚀 Feature Design & Implementation</option>
                    <option value="architecture" className="bg-[#03140d] text-white">🏛️ Architecture Decision</option>
                    <option value="guide" className="bg-[#03140d] text-white">📘 Guide / Developer SOP</option>
                  </select>
                </div>
              </div>

              {/* Bug Description */}
              <div className="space-y-1">
                <label className="text-rose-300 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Bug className="w-3.5 h-3.5" /> Bug / Problem Raised
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the issue, error trace, or problem encountered..."
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                />
              </div>

              {/* Resolution Method */}
              <div className="space-y-1">
                <label className="text-emerald-300 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Cleared By Stack / Method & Resolution Steps
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail the exact stack, fix method, code edit, or resolution steps used to clear this issue..."
                  value={resolutionMethod}
                  onChange={(e) => setResolutionMethod(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-mono"
                />
              </div>

              {/* Tech Stack & Tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold uppercase tracking-wider">Tech Stack Used</label>
                  <input
                    type="text"
                    placeholder="e.g. Next.js 15, FastAPI, PostgreSQL"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold uppercase tracking-wider">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. hydration, webpack, mobile"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Saving Note...' : editingNote ? 'Update Note' : 'Save Lifetime Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
