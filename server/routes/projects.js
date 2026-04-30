const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMember } = require('../middleware/role');
const { validateRequired, validateEmail } = require('../utils/validators');

const router = express.Router();

// GET /api/projects — list all projects for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, pm.role as my_role,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as done_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/projects — create a new project
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;

    const reqErr = validateRequired(['name'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const projResult = await client.query(
        'INSERT INTO projects (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
        [name.trim(), description || '', req.user.id]
      );

      const project = projResult.rows[0];

      // Creator is automatically admin
      await client.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
        [project.id, req.user.id, 'admin']
      );

      await client.query('COMMIT');

      res.status(201).json({
        project: { ...project, my_role: 'admin', member_count: 1, task_count: 0, done_count: 0 }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/projects/:id — get project details with members
router.get('/:id', authenticate, requireMember(), async (req, res) => {
  try {
    const projResult = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);

    if (projResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, pm.role, pm.joined_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.role ASC, pm.joined_at ASC`,
      [req.params.id]
    );

    res.json({
      project: projResult.rows[0],
      members: membersResult.rows,
      myRole: req.projectRole
    });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/projects/:id — update project (admin only)
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;

    const reqErr = validateRequired(['name'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const result = await pool.query(
      'UPDATE projects SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name.trim(), description || '', req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/projects/:id — delete project (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/projects/:id/members — add member by email (admin only)
router.post('/:id/members', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { email, role } = req.body;

    const reqErr = validateRequired(['email'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    const memberRole = role === 'admin' ? 'admin' : 'member';

    // Find user by email
    const userResult = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email.toLowerCase().trim()]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email. They must sign up first.' });
    }

    const targetUser = userResult.rows[0];

    // Check if already a member
    const existingMember = await pool.query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, targetUser.id]
    );

    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this project.' });
    }

    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [req.params.id, targetUser.id, memberRole]
    );

    res.status(201).json({
      member: { id: targetUser.id, name: targetUser.name, email: targetUser.email, role: memberRole }
    });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/projects/:id/members/:userId — remove member (admin only)
router.delete('/:id/members/:userId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    // Prevent admin from removing themselves if they're the only admin
    if (parseInt(req.params.userId) === req.user.id) {
      const adminCount = await pool.query(
        "SELECT COUNT(*) FROM project_members WHERE project_id = $1 AND role = 'admin'",
        [req.params.id]
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last admin from the project.' });
      }
    }

    const result = await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this project.' });
    }

    res.json({ message: 'Member removed successfully.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
