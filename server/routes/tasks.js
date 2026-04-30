const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMember } = require('../middleware/role');
const { validateRequired, validateEnum } = require('../utils/validators');

const router = express.Router();

// GET /api/projects/:id/tasks — list all tasks for a project
router.get('/projects/:id/tasks', authenticate, requireMember(), async (req, res) => {
  try {
    const { status, priority, assigned_to } = req.query;

    let query = `
      SELECT t.*, u.name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = $1
    `;
    const params = [req.params.id];
    let paramIndex = 2;

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }
    if (priority) {
      query += ` AND t.priority = $${paramIndex++}`;
      params.push(priority);
    }
    if (assigned_to) {
      query += ` AND t.assigned_to = $${paramIndex++}`;
      params.push(assigned_to);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('List tasks error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/projects/:id/tasks — create task (admin only)
router.post('/projects/:id/tasks', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { title, description, status, priority, due_date, assigned_to } = req.body;

    const reqErr = validateRequired(['title'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const statusErr = validateEnum(status, ['todo', 'in_progress', 'done'], 'Status');
    if (statusErr) return res.status(400).json({ error: statusErr });

    const priorityErr = validateEnum(priority, ['low', 'medium', 'high'], 'Priority');
    if (priorityErr) return res.status(400).json({ error: priorityErr });

    // If assigning, verify the target user is a member
    if (assigned_to) {
      const memberCheck = await pool.query(
        'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
        [req.params.id, assigned_to]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Assigned user is not a member of this project.' });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, priority, due_date, project_id, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        title.trim(),
        description || '',
        status || 'todo',
        priority || 'medium',
        due_date || null,
        req.params.id,
        assigned_to || null,
        req.user.id
      ]
    );

    // Fetch with assigned user name
    const task = result.rows[0];
    if (task.assigned_to) {
      const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [task.assigned_to]);
      task.assigned_to_name = userRes.rows[0]?.name || null;
    }

    res.status(201).json({ task });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/tasks/:id — get single task
router.get('/tasks/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.name as assigned_to_name, p.name as project_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = result.rows[0];

    // Check membership
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [task.project_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    res.json({ task, myRole: memberCheck.rows[0].role });
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/tasks/:id — update task
// Admin can update everything; member can only update status
router.put('/tasks/:id', authenticate, async (req, res) => {
  try {
    // Get the task first
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = taskResult.rows[0];

    // Check membership and role
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [task.project_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    const userRole = memberCheck.rows[0].role;
    const { title, description, status, priority, due_date, assigned_to } = req.body;

    if (userRole === 'member') {
      // Members can only change status
      if (title || description || priority || due_date || assigned_to !== undefined) {
        return res.status(403).json({ error: 'Members can only update task status.' });
      }

      const statusErr = validateEnum(status, ['todo', 'in_progress', 'done'], 'Status');
      if (statusErr) return res.status(400).json({ error: statusErr });

      const result = await pool.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );

      return res.json({ task: result.rows[0] });
    }

    // Admin: full update
    const statusErr = validateEnum(status, ['todo', 'in_progress', 'done'], 'Status');
    if (statusErr) return res.status(400).json({ error: statusErr });

    const priorityErr = validateEnum(priority, ['low', 'medium', 'high'], 'Priority');
    if (priorityErr) return res.status(400).json({ error: priorityErr });

    const result = await pool.query(
      `UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        due_date = $5,
        assigned_to = $6,
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        title?.trim(),
        description,
        status,
        priority,
        due_date || null,
        assigned_to || null,
        req.params.id
      ]
    );

    const updated = result.rows[0];
    if (updated.assigned_to) {
      const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [updated.assigned_to]);
      updated.assigned_to_name = userRes.rows[0]?.name || null;
    }

    res.json({ task: updated });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/tasks/:id — delete task (admin only)
router.delete('/tasks/:id', authenticate, async (req, res) => {
  try {
    const taskResult = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [req.params.id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Check admin role
    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [taskResult.rows[0].project_id, req.user.id]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only project admins can delete tasks.' });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
