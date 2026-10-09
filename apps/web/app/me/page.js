'use client';

import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { UserCheck, Shield, Key, LogOut, Activity, Edit3, X, Check, Mail, Briefcase, FileText, User, Camera, Upload, Loader2 } from 'lucide-react';
import Header from '../../components/Header';

// OneUni EMS Employee Profile Page
export default function MePage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();

  const fileInputRef = useRef(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [bio, setBio] = useState('');
  const [theme, setTheme] = useState('emerald');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      setFullName(user.full_name || '');
      setDesignation(user.designation || 'Team Member');
      setBio(user.bio || 'Agri Platform Innovator & EMS Team Contributor');
      setTheme(user.theme || 'emerald');
    }
  }, [loading, user, router]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSaveErr('Avatar image file size must be less than 5MB.');
      return;
    }

    setUploadingAvatar(true);
    setSaveErr('');
    setSaveMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/users/me/avatar', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to upload avatar image.');
      }

      setSaveMsg('Profile picture uploaded successfully!');
      if (refreshUser) {
        await refreshUser();
      }
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaveErr('');
    setSaveMsg('');
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          designation,
          bio,
          theme
        })
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || 'Failed to update profile.');
      }
      
      // Update local storage user session object
      if (typeof window !== 'undefined') {
        const savedSession = localStorage.getItem('ems_session');
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            parsed.full_name = fullName;
            parsed.designation = designation;
            parsed.bio = bio;
            parsed.theme = theme;
            localStorage.setItem('ems_session', JSON.stringify(parsed));
          } catch (e) {}
        }
      }

      setSaveMsg('Profile updated successfully! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#051812] text-slate-400">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading session...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] pb-12">
      <Header />
      <div className="max-w-4xl mx-auto p-3 sm:p-6 lg:p-12 space-y-6 sm:space-y-8">

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white">Employee Profile & Preferences</h1>
            <p className="text-xs text-emerald-400 font-semibold mt-0.5">Oneuni Agri Platform Pvt Ltd</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
            >
              <Edit3 className="w-4 h-4" /> Edit Profile
            </button>
            <button
              onClick={logout}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-xs font-bold transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Hidden File Input for Avatar Media Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          onChange={handleAvatarUpload}
          className="hidden"
        />

        {/* User Card */}
        <div className="glass-card p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-emerald-900/50 space-y-6 glow-emerald bg-[#03140f]/90">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-emerald-900/40">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Profile Avatar Container */}
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr ${
                theme === 'amber' ? 'from-amber-500 to-orange-600' :
                theme === 'sky' ? 'from-sky-500 to-indigo-600' :
                theme === 'purple' ? 'from-purple-500 to-pink-600' :
                theme === 'rose' ? 'from-rose-500 to-red-600' :
                'from-emerald-500 to-teal-600'
              } flex items-center justify-center text-white text-2xl sm:text-3xl font-black uppercase shadow-lg border border-white/20 overflow-hidden shrink-0`}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                ) : (
                  user.full_name.charAt(0)
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{user.full_name}</h2>
                  <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {user.email}
                </p>
                <p className="text-xs text-emerald-400 font-semibold mt-0.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {user.designation || 'Software Engineer / Team Specialist'}
                </p>
              </div>
            </div>
          </div>

          {/* Details Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#02100b] border border-emerald-900/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Key className="w-4 h-4 text-amber-400" /> User UUID
              </div>
              <p className="text-xs font-mono text-emerald-300 select-all">{user.id}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#02100b] border border-emerald-900/60 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <Shield className="w-4 h-4 text-emerald-400" /> Account Security Status
              </div>
              <p className="text-xs font-bold text-slate-200">
                {user.must_change_password ? (
                  <span className="text-amber-400">Password Reset Required</span>
                ) : (
                  <span className="text-emerald-400">Active & Verified</span>
                )}
              </p>
            </div>

            <div className="md:col-span-2 p-4 rounded-2xl bg-[#02100b] border border-emerald-900/60 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-teal-400" /> Employee Bio & Personal Note
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{user.bio || 'Agri Platform Specialist dedicated to building next-generation digital tools for agriculture and supply chain.'}"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 rounded-3xl border border-emerald-800/50 w-full max-w-md space-y-5 shadow-2xl bg-[#051a14]/95 text-white">
            <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold">Edit Profile & Details</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-emerald-900/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveErr && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {saveErr}
              </div>
            )}

            {saveMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                {saveMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Media Upload Section */}
              <div className="p-3.5 rounded-2xl bg-[#02100b] border border-emerald-900/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-900/50 flex items-center justify-center text-white font-bold text-base overflow-hidden shrink-0 border border-emerald-700/50">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      user.full_name?.charAt(0)
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Profile Photo (Media)</p>
                    <p className="text-[10px] text-slate-400">JPG, PNG, WEBP, GIF, SVG (Max 5MB)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingAvatar ? 'Uploading...' : 'Upload'}
                </button>
              </div>

              {/* Avatar Theme Color Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Avatar Color Theme</label>
                <div className="flex items-center gap-3">
                  {[
                    { id: 'emerald', bg: 'from-emerald-500 to-teal-600', label: 'Emerald' },
                    { id: 'amber', bg: 'from-amber-500 to-orange-600', label: 'Amber' },
                    { id: 'sky', bg: 'from-sky-500 to-indigo-600', label: 'Sky Blue' },
                    { id: 'purple', bg: 'from-purple-500 to-pink-600', label: 'Purple' },
                    { id: 'rose', bg: 'from-rose-500 to-red-600', label: 'Rose' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${t.bg} flex items-center justify-center text-white font-bold text-xs transition-transform ${
                        theme === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#051a14] scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={t.label}
                    >
                      {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Designation / Role Title</label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Personal Bio / Notes</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell your team about yourself..."
                  className="w-full px-4 py-2.5 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {saving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
