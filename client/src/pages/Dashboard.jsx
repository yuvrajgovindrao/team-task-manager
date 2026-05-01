import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../utils/api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    get('/dashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data) return <div className="empty-state"><h3>Failed to load dashboard</h3></div>;

  const { totalProjects, totalTasks, tasksByStatus, overdueTasks, recentTasks, myTasks } = data;
  const completionRate = totalTasks > 0 ? Math.round((tasksByStatus.done / totalTasks) * 100) : 0;

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isOverdue(d) {
    if (!d) return false;
    return new Date(d) < new Date(new Date().toDateString());
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your projects and tasks</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
          <div className="stat-icon">📁</div>
          <div className="stat-value">{totalProjects}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
          <div className="stat-icon">📋</div>
          <div className="stat-value">{totalTasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{completionRate}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon">⚠️</div>
          <div className="stat-value">{overdueTasks.length}</div>
          <div className="stat-label">Overdue Tasks</div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="stats-grid" style={{ marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-value">{tasksByStatus.todo}</div>
          <div className="stat-label">To Do</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">🔄</div>
          <div className="stat-value">{tasksByStatus.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">🎉</div>
          <div className="stat-value">{tasksByStatus.done}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>

      <div className="two-col">
        <div>
          {/* My Tasks */}
          {myTasks.length > 0 && (
            <div className="section">
              <div className="section-header"><h3>📌 My Open Tasks</h3></div>
              <div className="task-list">
                {myTasks.map(task => (
                  <div key={task.id} className="task-item" onClick={() => navigate(`/projects/${task.project_id}`)}>
                    <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                    <span className="task-title">{task.title}</span>
                    <span className="text-sm text-muted">{task.project_name}</span>
                    {task.due_date && (
                      <span className={`task-date ${isOverdue(task.due_date) ? 'overdue' : ''}`}>
                        {formatDate(task.due_date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Tasks */}
          <div className="section">
            <div className="section-header"><h3>🕐 Recent Tasks</h3></div>
            {recentTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No tasks yet</h3>
                <p>Create a project and add some tasks to get started.</p>
                <button className="btn btn-primary" onClick={() => navigate('/projects')}>Go to Projects</button>
              </div>
            ) : (
              <div className="task-list">
                {recentTasks.map(task => (
                  <div key={task.id} className="task-item" onClick={() => navigate(`/projects/${task.project_id}`)}>
                    <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                    <span className="task-title">{task.title}</span>
                    <span className="text-sm text-muted">{task.project_name}</span>
                    {task.assignee_names && <span className="task-assignee">👤 {task.assignee_names}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overdue sidebar */}
        <div>
          <div className="section">
            <div className="section-header"><h3>🔴 Overdue</h3></div>
            {overdueTasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎊</div>
                <p className="text-muted">No overdue tasks. Great job!</p>
              </div>
            ) : (
              <div className="task-list">
                {overdueTasks.map(task => (
                  <div key={task.id} className="task-item" onClick={() => navigate(`/projects/${task.project_id}`)}>
                    <span className="badge badge-overdue">overdue</span>
                    <div style={{ flex: 1 }}>
                      <div className="task-title">{task.title}</div>
                      <div className="text-sm text-muted">{task.project_name} · Due {formatDate(task.due_date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
