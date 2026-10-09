'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import { MessageSquare, Send, Hash, Users, Activity, Sparkles, User, Shield, Plus, Lock, Globe, CheckCircle2, X } from 'lucide-react';

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeChannel, setActiveChannel] = useState('general');
  const [activeRecipient, setActiveRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [channelsList, setChannelsList] = useState([
    { id: 'c-gen', name: 'general', slug: 'general', description: 'Company-wide team discussions' },
    { id: 'c-agri', name: 'agri-projects', slug: 'agri-projects', description: 'Agri platform & engineering updates' },
    { id: 'c-ann', name: 'announcements', slug: 'announcements', description: 'Broadcast discussions' },
  ]);
  const [fetching, setFetching] = useState(true);
  const messagesEndRef = useRef(null);

  const [unreadChannels, setUnreadChannels] = useState({});
  const [unreadDms, setUnreadDms] = useState({});
  const [recentDms, setRecentDms] = useState({});

  // Group Creation State
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users/team');
      if (res.ok) {
        const list = await res.json();
        setUsersList(list.filter(u => u.id !== user?.id));
      }
    } catch (e) {}
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/chat/channels');
      if (res.ok) {
        const list = await res.json();
        setChannelsList(list);
      }
    } catch (e) {}
  };

  const fetchUnreadCounts = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/chat/unread');
      if (res.ok) {
        const data = await res.json();
        setUnreadChannels(data.unread_channels || {});
        setUnreadDms(data.unread_dms || {});
        if (data.recent_dms) setRecentDms(data.recent_dms);
      }
    } catch (e) {}
  };

  const markTargetRead = async (target) => {
    if (!user || !target) return;
    try {
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      fetchUnreadCounts();
    } catch (e) {}
  };

  const fetchMessages = async () => {
    if (!user) return;
    try {
      let url = `/api/chat/messages?channel=${activeChannel}`;
      if (activeRecipient) {
        url = `/api/chat/messages?recipient_id=${activeRecipient.id}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {} finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else {
        fetchUsers();
        fetchChannels();
        fetchMessages();
        fetchUnreadCounts();
      }
    }
  }, [loading, user, activeChannel, activeRecipient, router]);

  useEffect(() => {
    if (!loading && user) {
      const activeTarget = activeRecipient ? `dm:${activeRecipient.id}` : `channel:${activeChannel}`;
      markTargetRead(activeTarget);
    }
  }, [activeChannel, activeRecipient, loading, user]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessages();
      fetchUnreadCounts();
      fetchChannels();
    }, 3000);
    return () => clearInterval(interval);
  }, [user, activeChannel, activeRecipient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const payload = {
      channel: activeRecipient ? 'direct' : activeChannel,
      recipient_id: activeRecipient ? activeRecipient.id : null,
      message: newMessage.trim(),
    };

    setNewMessage('');
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        fetchMessages();
        const activeTarget = activeRecipient ? `dm:${activeRecipient.id}` : `channel:${activeChannel}`;
        markTargetRead(activeTarget);
      }
    } catch (e) {}
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          is_private: newGroupIsPrivate,
          member_ids: selectedMemberIds,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupDesc('');
        setNewGroupIsPrivate(false);
        setSelectedMemberIds([]);
        await fetchChannels();
        setActiveChannel(created.slug);
        setActiveRecipient(null);
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create channel');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleMemberSelection = (uid) => {
    if (selectedMemberIds.includes(uid)) {
      setSelectedMemberIds(selectedMemberIds.filter(id => id !== uid));
    } else {
      setSelectedMemberIds([...selectedMemberIds, uid]);
    }
  };

  // Sort Direct Messages based on recent chat activity
  const sortedUsersList = [...usersList].sort((a, b) => {
    const tA = recentDms[a.id] ? new Date(recentDms[a.id]).getTime() : 0;
    const tB = recentDms[b.id] ? new Date(recentDms[b.id]).getTime() : 0;
    if (tA !== tB) return tB - tA;
    return a.full_name.localeCompare(b.full_name);
  });

  // Mobile view state ('chat' | 'sidebar')
  const [mobileTab, setMobileTab] = useState('chat');

  if (loading || !user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] text-white flex flex-col">
      <Header />

      <div className="max-w-7xl mx-auto w-full p-4 lg:p-8 flex-1 flex flex-col md:flex-row gap-6">

        {/* Mobile Navigation Toggle (Chat vs Channels & DMs) */}
        <div className="flex md:hidden items-center gap-2 p-1.5 bg-[#03110d] rounded-2xl border border-emerald-900/60 mb-1">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              mobileTab === 'chat'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Active Chat
          </button>
          <button
            onClick={() => setMobileTab('sidebar')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all relative ${
              mobileTab === 'sidebar'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Channels & DMs
          </button>
        </div>

        {/* Sidebar Channels & Team Members */}
        <div className={`w-full md:w-72 glass-card p-5 rounded-3xl border border-emerald-900/50 bg-[#03140f]/90 flex flex-col justify-between gap-4 ${
          mobileTab === 'sidebar' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Team Channels
                </h2>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {channelsList.map((ch) => {
                  const chSlug = ch.slug || ch.name;
                  const hasUnread = unreadChannels[chSlug] > 0 && (activeChannel !== chSlug || activeRecipient);
                  return (
                    <button
                      key={ch.id || chSlug}
                      onClick={() => {
                        setActiveChannel(chSlug);
                        setActiveRecipient(null);
                        setMobileTab('chat');
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                        activeChannel === chSlug && !activeRecipient
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                          : 'text-slate-300 hover:bg-emerald-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {ch.is_private ? <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" /> : <Hash className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        <span className="truncate">#{ch.name}</span>
                      </div>
                      {hasUnread && (
                        <span className="relative flex h-2.5 w-2.5 shrink-0" title={`${unreadChannels[chSlug]} new message(s)`}>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-emerald-900/50 pt-3 flex-1 flex flex-col min-h-0">
              <h2 className="text-sm font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" /> Direct Messages ({sortedUsersList.length})
              </h2>
              <div className="space-y-1 flex-1 overflow-y-auto max-h-[380px] min-h-[220px] pr-1">
                {sortedUsersList.map((u) => {
                  const hasUnread = unreadDms[u.id] > 0 && activeRecipient?.id !== u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => {
                        setActiveRecipient(u);
                        setMobileTab('chat');
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                        activeRecipient?.id === u.id
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                          : 'text-slate-300 hover:bg-emerald-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-extrabold flex items-center justify-center text-[10px] shrink-0 overflow-hidden">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.full_name} className="w-full h-full object-cover" />
                          ) : (
                            u.full_name.charAt(0)
                          )}
                        </div>
                        <span className="truncate max-w-[105px]">{u.full_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-emerald-400/80 font-mono uppercase">{u.role_name}</span>
                        {hasUnread && (
                          <span className="relative flex h-2.5 w-2.5" title={`${unreadDms[u.id]} new message(s)`}>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Create Group Option */}
          <div className="border-t border-emerald-900/50 pt-3 shrink-0">
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="w-full px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 text-emerald-400" /> Create New Group
            </button>
          </div>
        </div>

        {/* Chat Feed & Input Area */}
        <div className={`flex-1 glass-card p-4 sm:p-6 rounded-3xl border border-emerald-900/50 flex flex-col justify-between bg-[#03140f]/90 space-y-4 ${
          mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
        }`}>
          
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-emerald-900/50 pb-4">
            <div className="flex items-center gap-2">
              {activeRecipient ? (
                <>
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0">
                    {activeRecipient.avatar_url ? (
                      <img src={activeRecipient.avatar_url} alt={activeRecipient.full_name} className="w-full h-full object-cover" />
                    ) : (
                      activeRecipient.full_name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{activeRecipient.full_name}</h3>
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase">Direct Message ({activeRecipient.role_name})</p>
                  </div>
                </>
              ) : (
                <>
                  <Hash className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">#{activeChannel}</h3>
                    <p className="text-[10px] text-slate-400">OneUni Team Discussion Channel</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-[350px] max-h-[500px] pr-2">
            {messages.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                No messages in this discussion yet. Start the conversation!
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === user.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {!isMe && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-900/60 border border-emerald-700/50 flex items-center justify-center text-white text-[10px] font-bold uppercase shrink-0 overflow-hidden mt-1">
                        {m.sender_avatar ? (
                          <img src={m.sender_avatar} alt={m.sender_name} className="w-full h-full object-cover" />
                        ) : (
                          m.sender_name?.charAt(0) || 'U'
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-bold text-emerald-400">{isMe ? 'You' : m.sender_name}</span>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-xs max-w-md leading-relaxed ${
                          isMe
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-br-none shadow-md shadow-emerald-500/20'
                            : 'bg-[#02100b] border border-emerald-900/60 text-slate-200 rounded-bl-none'
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send Message Form */}
          <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t border-emerald-900/50">
            <input
              type="text"
              placeholder={activeRecipient ? `Message ${activeRecipient.full_name}...` : `Message #${activeChannel}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 px-4 py-3 bg-[#02100b] border border-emerald-900/70 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        </div>

      </div>

      {/* Create New Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-emerald-700/60 w-full max-w-lg space-y-5 bg-[#041a13]/95 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-900/80 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-extrabold text-white">Create New Group / Channel</h3>
              </div>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Group / Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-emerald-400 font-bold">#</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Agri-Devs, Management-Sync..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 bg-[#02100b] border border-emerald-900/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Discussion channel for specific project goals..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#02100b] border border-emerald-900/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-slate-400 uppercase font-bold text-[10px]">Group Access Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewGroupIsPrivate(false)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      !newGroupIsPrivate
                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                        : 'bg-[#02100b] border-emerald-900/60 text-slate-400'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs">Public Group</p>
                      <p className="text-[9px] text-slate-400 font-normal">All team members</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewGroupIsPrivate(true)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      newGroupIsPrivate
                        ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                        : 'bg-[#02100b] border-emerald-900/60 text-slate-400'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-xs">Private Group</p>
                      <p className="text-[9px] text-slate-400 font-normal">Selected members only</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Member Selection if Private Group */}
              {newGroupIsPrivate && (
                <div className="space-y-2 border-t border-emerald-900/60 pt-3">
                  <label className="text-slate-400 uppercase font-bold text-[10px] flex items-center justify-between">
                    <span>Grant Group Access To Members</span>
                    <span className="text-emerald-400">{selectedMemberIds.length} selected</span>
                  </label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 bg-[#02100b] p-2.5 rounded-xl border border-emerald-900/70">
                    {usersList.map((u) => {
                      const isSelected = selectedMemberIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleMemberSelection(u.id)}
                          className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40' : 'hover:bg-emerald-950/40 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{u.full_name}</span>
                            <span className="text-[10px] text-slate-400">({u.role_name})</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-emerald-900/60">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
                >
                  {creatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
