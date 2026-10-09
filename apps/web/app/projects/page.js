'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import { FolderKanban, Plus, CheckSquare, Clock, ArrowLeft, AlertCircle, CheckCircle2, User, MessageSquare, Edit, Lightbulb, Sparkles, X } from 'lucide-react';

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetail, setProjectDetail] = useState(null);
  const [employees, setEmployees] = useState([]);

  // Form states - Create Project
  const [showNewProjModal, setShowNewProjModal] = useState(false);
  const [projName, setProjName] = useState('');
  const [projCode, setProjCode] = useState('');
  const [projDesc, setProjDesc] = useState('');

  // Form states - Create Task
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('med');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskCategoryStatus, setTaskCategoryStatus] = useState('todo');

  // Form states - Edit Task
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('med');
  const [editAssignee, setEditAssignee] = useState('');
  const [editStatus, setEditStatus] = useState('todo');

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const json = await res.json();
        setProjects(json);
        if (json.length > 0 && !selectedProject) {
          setSelectedProject(json[0].id);
        }
      }
      // Fetch employees for assignee selection
      const empRes = await fetch('/api/users');
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjectDetail = async (projId) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/projects/${projId}`);
      if (res.ok) {
        const json = await res.json();
        setProjectDetail(json);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else fetchProjects();
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectDetail(selectedProject);
    }
  }, [selectedProject]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projName, code: projCode, description: projDesc }),
      });
      if (res.ok) {
        setShowNewProjModal(false);
        setProjName('');
        setProjCode('');
        setProjDesc('');
        fetchProjects();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Failed to create project');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          priority: taskPriority,
          assignee_id: taskAssignee || user.id
        }),
      });
      if (res.ok) {
        setShowNewTaskModal(false);
        setTaskTitle('');
        setTaskDesc('');
        fetchProjectDetail(selectedProject);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await fetch(`/api/projects/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note: `Status updated to ${newStatus}` }),
      });
      if (res.ok) {
        fetchProjectDetail(selectedProject);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to update task status');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEditTask = (t) => {
    setEditingTask(t);
    setEditTitle(t.title || '');
    setEditDesc(t.description || '');
    setEditPriority(t.priority || 'med');
    setEditAssignee(t.assignee_id || '');
    setEditStatus(t.status || 'todo');
  };

  const handleSaveEditTask = async (e) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      const res = await fetch(`/api/projects/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDesc,
          priority: editPriority,
          assignee_id: editAssignee || null,
          status: editStatus,
        }),
      });
      if (res.ok) {
        setEditingTask(null);
        fetchProjectDetail(selectedProject);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to edit task');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#051812] text-slate-400">
        <div className="flex items-center gap-3">
          <FolderKanban className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading Projects Board...</span>
        </div>
      </main>
    );
  }

  const columns = [
    { key: 'todo', label: 'To Do', color: 'border-slate-700 bg-slate-900/60' },
    { key: 'in_progress', label: 'In Progress', color: 'border-sky-500/40 bg-sky-500/10' },
    { key: 'review', label: 'Review', color: 'border-amber-500/40 bg-amber-500/10' },
    { key: 'future_plan', label: 'Future Roadmap & Ideas 💡', color: 'border-purple-500/40 bg-purple-500/10' },
    { key: 'done', label: 'Done', color: 'border-emerald-500/40 bg-emerald-500/10' },
  ];

  return (
    <main className="min-h-screen relative bg-gradient-to-b from-[#051812] via-[#06241a] to-[#04120d] text-white pb-12">
      <Header />
      <div className="max-w-7xl mx-auto p-6 lg:p-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-emerald-900/40">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <FolderKanban className="w-8 h-8 text-emerald-400" /> Project Board & Future Roadmap
            </h1>
            <p className="text-slate-400 text-sm mt-1">Drag-and-drop tasks between columns, manage roadmap ideas, and update task assignments.</p>
          </div>

          {(user?.role === 'admin' || user?.role === 'md') && (
            <button
              onClick={() => setShowNewProjModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          )}
        </div>

        {/* Project Selector Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                selectedProject === p.id
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 glow-emerald'
                  : 'bg-[#03140d]/80 border-emerald-900/40 text-slate-400 hover:border-emerald-700'
              }`}
            >
              {p.code} - {p.name} ({p.task_count} Tasks)
            </button>
          ))}
        </div>

        {/* Kanban Board Columns */}
        {projectDetail && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>{projectDetail.project.name}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">{projectDetail.project.code}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{projectDetail.project.description}</p>
              </div>

              <button
                onClick={() => setShowNewTaskModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-500/30"
              >
                <Plus className="w-4 h-4 text-emerald-400" /> Add Task / Future Idea
              </button>
            </div>

            {/* Drag and Drop Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {columns.map((col) => {
                const colTasks = projectDetail.tasks.filter((t) => t.status === col.key);
                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const droppedTaskId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('taskId');
                      if (droppedTaskId) {
                        handleStatusChange(droppedTaskId, col.key);
                      }
                    }}
                    className={`glass-card p-3 sm:p-4 rounded-2xl sm:rounded-3xl border space-y-3 sm:space-y-4 min-h-[350px] sm:min-h-[400px] transition-all ${col.color}`}
                  >
                    <div className="flex items-center justify-between pb-2.5 border-b border-emerald-900/30">
                      <span className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                        {col.key === 'future_plan' && <Lightbulb className="w-3.5 h-3.5 text-purple-400" />}
                        {col.label}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-[#03140d] text-emerald-300 border border-emerald-900/40">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {colTasks.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-6 text-center italic border-2 border-dashed border-emerald-900/30 rounded-xl">Drag tasks here</p>
                      ) : (
                        colTasks.map((t) => (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', t.id);
                              e.dataTransfer.setData('taskId', t.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            className="p-3.5 rounded-2xl bg-[#03140d]/90 border border-emerald-900/50 hover:border-emerald-500/60 transition-all cursor-grab active:cursor-grabbing space-y-2.5 shadow-md group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-white text-xs leading-snug">{t.title}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                {(user?.role === 'admin' || user?.role === 'md') && (
                                  <button
                                    onClick={() => handleOpenEditTask(t)}
                                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-emerald-300 transition-colors"
                                    title="Edit Task Details"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {t.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2">{t.description}</p>
                            )}

                            <div className="flex flex-col gap-2 pt-1 border-t border-emerald-900/30">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-bold uppercase text-emerald-400">{t.priority} priority</span>
                                <span className="font-semibold text-slate-300">{t.assignee_name || 'Unassigned'}</span>
                              </div>

                              {/* Mobile 1-Tap Quick Move Status Dropdown */}
                              <div className="flex items-center justify-between gap-2 pt-1 bg-[#02100b] p-1.5 rounded-xl border border-emerald-900/40 text-[10px]">
                                <span className="text-slate-400 font-semibold">Move:</span>
                                <select
                                  value={t.status}
                                  onChange={(e) => handleStatusChange(t.id, e.target.value)}
                                  className="bg-transparent text-emerald-300 font-bold focus:outline-none cursor-pointer text-[10px]"
                                >
                                  {columns.map((c) => (
                                    <option key={c.key} value={c.key} className="bg-[#03140d] text-white">
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline Feed */}
            <div className="glass-card p-6 md:p-8 rounded-3xl border border-emerald-900/40 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" /> Project Audit & Timeline Log
              </h3>

              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {projectDetail.timeline.map((u) => (
                  <div key={u.id} className="p-3 rounded-xl bg-[#03140d]/60 border border-emerald-900/40 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white">{u.user_name}</span>
                      <span className="text-slate-400 ml-2">updated status to <span className="text-emerald-400 font-bold uppercase">{u.new_status.replace('_', ' ')}</span></span>
                      {u.note && <span className="text-slate-500 ml-2">("{u.note}")</span>}
                    </div>
                    <span className="text-slate-500 font-mono">{new Date(u.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        {showNewProjModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-card p-8 rounded-3xl border border-emerald-900/50 w-full max-w-md space-y-6">
              <h3 className="text-xl font-bold text-white">Create New Project</h3>
              <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
                <input
                  type="text"
                  required
                  placeholder="Project Name (e.g. Agri Super App)"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                />
                <input
                  type="text"
                  required
                  placeholder="Project Code (e.g. AGRI-APP)"
                  value={projCode}
                  onChange={(e) => setProjCode(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm uppercase font-mono"
                />
                <textarea
                  placeholder="Description..."
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                />
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewProjModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-emerald-600 text-white font-bold">Create Project</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Task Modal */}
        {showNewTaskModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-card p-8 rounded-3xl border border-emerald-900/50 w-full max-w-md space-y-6">
              <h3 className="text-xl font-bold text-white">Add Task / Future Idea</h3>
              <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
                <input
                  type="text"
                  required
                  placeholder="Task Title or Idea..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                />
                <textarea
                  placeholder="Description / Requirements..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                />
                <div>
                  <label className="text-slate-400 block mb-1">Assignee</label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                  >
                    <option value="">Assigned to Me ({user.full_name})</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role_name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                  >
                    <option value="low">Low Priority</option>
                    <option value="med">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewTaskModal(false)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-emerald-600 text-white font-bold">Add Task</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Task Modal */}
        {editingTask && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-card p-8 rounded-3xl border border-emerald-900/50 w-full max-w-md space-y-6">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit className="w-5 h-5 text-emerald-400" /> Edit Assigned Task
                </h3>
                <button onClick={() => setEditingTask(null)} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditTask} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Status / Column</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="future_plan">Future Roadmap & Ideas</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Assignee</label>
                  <select
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role_name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-4 py-3 bg-[#03140d] border border-emerald-900/60 rounded-xl text-white text-sm"
                  >
                    <option value="low">Low Priority</option>
                    <option value="med">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingTask(null)} className="w-1/2 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancel</button>
                  <button type="submit" className="w-1/2 py-3 rounded-xl bg-emerald-600 text-white font-bold">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
