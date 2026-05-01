import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post, put, del } from '../utils/api';
import Modal from '../components/Modal';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [myRole, setMyRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState(null);

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEditTask, setShowEditTask] = useState(null);
  const [showEditProject, setShowEditProject] = useState(false);

  // Expanded task
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  // Confirmation state
  const [confirmAction, setConfirmAction] = useState(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [projData, tasksData, meData] = await Promise.all([
        get(`/projects/${id}`),
        get(`/projects/${id}/tasks`),
        get('/auth/me'),
      ]);
      setProject(projData.project);
      setMembers(projData.members);
      setMyRole(projData.myRole);
      setTasks(tasksData.tasks);
      setMyUserId(meData.user.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks() {
    try {
      let url = `/projects/${id}/tasks`;
      const params = [];
      if (filterStatus) params.push(`status=${filterStatus}`);
      if (filterPriority) params.push(`priority=${filterPriority}`);
      if (params.length) url += '?' + params.join('&');
      const data = await get(url);
      setTasks(data.tasks);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => { if (project) loadTasks(); }, [filterStatus, filterPriority]);

  const isAdmin = myRole === 'admin';

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isOverdue(d) {
    if (!d) return false;
    return new Date(d) < new Date(new Date().toDateString());
  }

  async function handleDeleteProject() {
    try {
      await del(`/projects/${id}`);
      navigate('/projects');
    } catch (err) {
      alert(err.message || 'Failed to delete project.');
    }
    setConfirmAction(null);
  }

  async function handleRemoveMember(memberId, memberName) {
    try {
      await del(`/projects/${id}/members/${memberId}`);
      setMembers(prev => prev.filter(x => x.id !== memberId));
    } catch (err) {
      alert(err.message || 'Failed to remove member.');
    }
    setConfirmAction(null);
  }

  function toggleExpand(taskId) {
    setExpandedTaskId(prev => prev === taskId ? null : taskId);
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!project) return <div className="empty-state"><h3>Project not found</h3><button className="btn btn-primary" onClick={() => navigate('/projects')}>Back</button></div>;

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>← Back</button>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditProject(true)}>✏️ Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmAction({
              title: 'Delete Project',
              message: `Are you sure you want to delete "${project.name}" and all its tasks? This cannot be undone.`,
              onConfirm: handleDeleteProject
            })}>🗑️ Delete</button>
          </div>
        )}
      </div>

      <div className="page-header">
        <h2>{project.name}</h2>
        <p>{project.description || 'No description'}</p>
      </div>

      <div className="two-col">
        {/* Tasks */}
        <div>
          <div className="flex-between mb-16">
            <h3>📋 Tasks ({tasks.length})</h3>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}>+ Add Task</button>}
          </div>

          <div className="filter-bar">
            <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No tasks yet</h3>
              <p>{isAdmin ? 'Create the first task for this project.' : 'Waiting for tasks to be assigned.'}</p>
            </div>
          ) : (
            <div className="task-list">
              {tasks.map(task => {
                const expanded = expandedTaskId === task.id;
                return (
                  <div key={task.id} className={`task-item-wrap ${expanded ? 'expanded' : ''}`}>
                    <div className="task-item" onClick={() => toggleExpand(task.id)}>
                      <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="task-title">{task.title}</div>
                        <div className="flex gap-8 mt-8" style={{ flexWrap: 'wrap' }}>
                          <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                          {task.assigned_to_name && <span className="text-sm text-muted">👤 {task.assigned_to_name}</span>}
                          {task.due_date && (
                            <span className={`text-sm ${isOverdue(task.due_date) && task.status !== 'done' ? 'task-date overdue' : 'text-muted'}`}>
                              📅 {formatDate(task.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
                    </div>
                    {expanded && (
                      <div className="task-details">
                        <div className="task-details-grid">
                          <div className="detail-item">
                            <span className="detail-label">Status</span>
                            <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Priority</span>
                            <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Assigned To</span>
                            <span>{task.assigned_to_name || 'Unassigned'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Due Date</span>
                            <span className={isOverdue(task.due_date) && task.status !== 'done' ? 'overdue' : ''}>
                              {task.due_date ? formatDate(task.due_date) : 'No due date'}
                            </span>
                          </div>
                        </div>
                        {task.description && (
                          <div style={{ marginTop: 12 }}>
                            <span className="detail-label">Description</span>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                              {task.description}
                            </p>
                          </div>
                        )}
                        <div className="detail-item" style={{ marginTop: 8 }}>
                          <span className="detail-label">Created</span>
                          <span className="text-sm text-muted">{formatDate(task.created_at)}</span>
                        </div>
                        {isAdmin && (
                          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setShowEditTask(task); }}>
                              ✏️ Edit Task
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={(e) => {
                              e.stopPropagation();
                              setConfirmAction({
                                title: 'Delete Task',
                                message: `Delete "${task.title}"? This cannot be undone.`,
                                onConfirm: async () => {
                                  try {
                                    await del(`/tasks/${task.id}`);
                                    setTasks(prev => prev.filter(t => t.id !== task.id));
                                    setExpandedTaskId(null);
                                  } catch (err) {
                                    alert(err.message || 'Failed to delete task.');
                                  }
                                  setConfirmAction(null);
                                }
                              });
                            }}>
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Members sidebar */}
        <div>
          <div className="flex-between mb-16">
            <h3>👥 Members ({members.length})</h3>
            {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => setShowMemberModal(true)}>+ Add</button>}
          </div>

          <div className="members-list">
            {members.map(m => {
              // Admin can remove anyone except themselves
              const canRemove = isAdmin && m.id !== myUserId;
              return (
                <div key={m.id} className="member-item">
                  <div className="member-avatar">{m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>
                  <div className="member-info">
                    <div className="member-name">{m.name}</div>
                    <div className="member-email">{m.email}</div>
                  </div>
                  <span className={`badge badge-${m.role}`}>{m.role}</span>
                  {canRemove && (
                    <button className="btn-icon" style={{ fontSize: 12 }} onClick={(e) => {
                      e.stopPropagation();
                      setConfirmAction({
                        title: 'Remove Member',
                        message: `Remove ${m.name} (${m.role}) from this project?`,
                        onConfirm: () => handleRemoveMember(m.id, m.name)
                      });
                    }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showTaskModal && <TaskFormModal projectId={id} members={members} onClose={() => setShowTaskModal(false)} onCreated={task => { setTasks(prev => [task, ...prev]); setShowTaskModal(false); }} />}

      {/* Add Member Modal */}
      {showMemberModal && <MemberFormModal projectId={id} onClose={() => setShowMemberModal(false)} onAdded={m => { setMembers(prev => [...prev, m]); setShowMemberModal(false); }} />}

      {/* Edit Task Modal */}
      {showEditTask && <EditTaskModal task={showEditTask} isAdmin={isAdmin} members={members} projectId={id} onClose={() => setShowEditTask(null)} onUpdated={updated => { setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t)); setShowEditTask(null); }} onDeleted={taskId => { setTasks(prev => prev.filter(t => t.id !== taskId)); setShowEditTask(null); setExpandedTaskId(null); }} />}

      {/* Edit Project Modal */}
      {showEditProject && <EditProjectModal project={project} onClose={() => setShowEditProject(false)} onUpdated={updated => { setProject(updated); setShowEditProject(false); }} />}

      {/* Confirmation Modal */}
      {confirmAction && (
        <Modal title={confirmAction.title} onClose={() => setConfirmAction(null)}>
          <p style={{ marginBottom: 24, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{confirmAction.message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmAction.onConfirm}>Confirm</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* --- Sub-components --- */

function TaskFormModal({ projectId, members, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = await post(`/projects/${projectId}/tasks`, {
        title, description, status, priority,
        due_date: dueDate || null,
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
      });
      onCreated(data.task);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Create Task" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="Task title" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Status</label>
            <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Assign To</label>
            <select className="form-select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</button>
        </div>
      </form>
    </Modal>
  );
}

function MemberFormModal({ projectId, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = await post(`/projects/${projectId}/members`, { email, role });
      onAdded(data.member);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Member" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="member@example.com" />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Member'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditProjectModal({ project, onClose, onUpdated }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const data = await put(`/projects/${project.id}`, { name, description });
      onUpdated(data.project);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Project" onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Project Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} required autoFocus />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditTaskModal({ task, isAdmin, members, projectId, onClose, onUpdated, onDeleted }) {
  const [status, setStatus] = useState(task.status);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = isAdmin
        ? { title, description, status, priority, due_date: dueDate || null, assigned_to: assignedTo ? parseInt(assignedTo) : null }
        : { status };
      const data = await put(`/tasks/${task.id}`, body);
      onUpdated(data.task);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await del(`/tasks/${task.id}`);
      onDeleted(task.id);
    } catch (err) {
      setError(err.message);
      setShowDeleteConfirm(false);
    }
  }

  if (showDeleteConfirm) {
    return (
      <Modal title="Delete Task" onClose={() => setShowDeleteConfirm(false)}>
        <p style={{ marginBottom: 24, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Are you sure you want to delete "<strong>{task.title}</strong>"? This cannot be undone.
        </p>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Delete Task</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={isAdmin ? 'Edit Task' : 'Update Status'} onClose={onClose}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        {isAdmin ? (
          <>
            <div className="form-group">
              <label>Title</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-textarea" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Status</label>
                <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" className="form-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Assign To</label>
                <select className="form-select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="form-group">
            <label>Status</label>
            <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div>{isAdmin && <button type="button" className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>🗑️ Delete Task</button>}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
