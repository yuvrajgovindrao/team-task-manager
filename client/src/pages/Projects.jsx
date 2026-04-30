import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../utils/api';
import Modal from '../components/Modal';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await get('/projects');
      setProjects(data.projects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const data = await post('/projects', { name, description });
      setProjects(prev => [data.project, ...prev]);
      setShowModal(false);
      setName('');
      setDescription('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function getProgress(p) {
    if (!p.task_count || parseInt(p.task_count) === 0) return 0;
    return Math.round((parseInt(p.done_count) / parseInt(p.task_count)) * 100);
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 32 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2>Projects</h2>
          <p>Manage your team projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No projects yet</h3>
          <p>Create your first project to start managing tasks.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Project</button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(p => (
            <div key={p.id} className="card card-clickable project-card" onClick={() => navigate(`/projects/${p.id}`)}>
              <h3>{p.name}</h3>
              <p className="project-desc">{p.description || 'No description'}</p>
              <div className="project-meta">
                <span>👥 {p.member_count} member{p.member_count !== 1 ? 's' : ''}</span>
                <span>📋 {p.task_count} task{parseInt(p.task_count) !== 1 ? 's' : ''}</span>
                <span className={`badge badge-${p.my_role}`}>{p.my_role}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${getProgress(p)}%` }}></div>
              </div>
              <div className="text-sm text-muted mt-8">{getProgress(p)}% complete</div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Create Project" onClose={() => { setShowModal(false); setError(''); }}>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="project-name">Project Name</label>
              <input id="project-name" className="form-input" placeholder="My Awesome Project"
                value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="project-desc">Description</label>
              <textarea id="project-desc" className="form-textarea" placeholder="What's this project about?"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
