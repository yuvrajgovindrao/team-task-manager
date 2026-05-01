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

  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showEditTask, setShowEditTask] = useState(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [projData, tasksData] = await Promise.all([
        get(`/projects/${id}`),
        get(`/projects/${id}/tasks`),
      ]);
      setProject(projData.project);
      setMembers(projData.members);
      setMyRole(projData.myRole);
      setTasks(tasksData.tasks);
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

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!project) return <div className="empty-state"><h3>Project not found</h3><button className="btn btn-primary" onClick={() => navigate('/projects')}>Back</button></div>;

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>← Back</button>
        {isAdmin && (
          <button className="btn btn-danger btn-sm" onClick={async () => {
            if (confirm('Delete this project and all its tasks?')) {
              try {
                await del(`/projects/${id}`);
                navigate('/projects');
              } catch (err) {
                alert(err.message || 'Failed to delete project.');
              }
            }
          }}>Delete Project</button>
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
              {tasks.map(task => (
                <div key={task.id} className="task-item" onClick={() => setShowEditTask(task)}>
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
                </div>
              ))}
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
            {members.map(m => (
              <div key={m.id} className="member-item">
                <div className="member-avatar">{m.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>
                <div className="member-info">
                  <div className="member-name">{m.name}</div>
                  <div className="member-email">{m.email}</div>
                </div>
                <span className={`badge badge-${m.role}`}>{m.role}</span>
                {isAdmin && m.role !== 'admin' && (
                  <button className="btn-icon" style={{ fontSize: 12 }} onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Remove ${m.name}?`)) {
                      try {
                        await del(`/projects/${id}/members/${m.id}`);
                        setMembers(prev => prev.filter(x => x.id !== m.id));
                      } catch (err) {
                        alert(err.message || 'Failed to remove member.');
                      }
                    }
                  }}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showTaskModal && <TaskFormModal projectId={id} members={members} onClose={() => setShowTaskModal(false)} onCreated={task => { setTasks(prev => [task, ...prev]); setShowTaskModal(false); }} />}

      {/* Add Member Modal */}
      {showMemberModal && <MemberFormModal projectId={id} onClose={() => setShowMemberModal(false)} onAdded={m => { setMembers(prev => [...prev, m]); setShowMemberModal(false); }} />}

      {/* Edit Task Modal */}
      {showEditTask && <EditTaskModal task={showEditTask} isAdmin={isAdmin} members={members} onClose={() => setShowEditTask(null)} onUpdated={updated => { setTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t)); setShowEditTask(null); }} onDeleted={taskId => { setTasks(prev => prev.filter(t => t.id !== taskId)); setShowEditTask(null); }} />}
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

function EditTaskModal({ task, isAdmin, members, onClose, onUpdated, onDeleted }) {
  const [status, setStatus] = useState(task.status);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.split('T')[0] : '');
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    if (confirm('Delete this task?')) {
      try {
        await del(`/tasks/${task.id}`);
        onDeleted(task.id);
      } catch (err) {
        setError(err.message);
      }
    }
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
          <div>{isAdmin && <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>Delete Task</button>}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
