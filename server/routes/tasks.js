const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireMember } = require('../middleware/role');
const { validateRequired, validateEnum } = require('../utils/validators');

const router = express.Router();

// Helper: fetch assignees for tasks
async function attachAssignees(tasks) {
  if (tasks.length === 0) return tasks;
  const taskIds = tasks.map(t => t.id);
  const result = await pool.query(
    `SELECT ta.task_id, u.id as user_id, u.name
     FROM task_assignees ta
     JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id = ANY($1)
     ORDER BY ta.assigned_at ASC`,
    [taskIds]
  );
  const map = {};
  for (const row of result.rows) {
    if (!map[row.task_id]) map[row.task_id] = [];
    map[row.task_id].push({ id: row.user_id, name: row.name });
  }
  return tasks.map(t => ({ ...t, assignees: map[t.id] || [] }));
}

// Helper: sync assignees for a task
async function syncAssignees(client, taskId, projectId, userIds) {
  // Remove old
  await client.query('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);
  if (!userIds || userIds.length === 0) return;

  // Verify all are project members
  const memberCheck = await client.query(
    'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = ANY($2)',
    [projectId, userIds]
  );
  const validIds = memberCheck.rows.map(r => r.user_id);

  // Insert valid assignees
  for (const uid of validIds) {
    await client.query(
      'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, uid]
    );
  }
  // Also keep legacy assigned_to in sync (first assignee)
  await client.query(
    'UPDATE tasks SET assigned_to = $1 WHERE id = $2',
    [validIds[0] || null, taskId]
  );
}

// GET /api/projects/:id/tasks
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
      query += ` AND t.id IN (SELECT task_id FROM task_assignees WHERE user_id = $${paramIndex++})`;
      params.push(assigned_to);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    const tasks = await attachAssignees(result.rows);
    res.json({ tasks });
  } catch (err) {
    console.error('List tasks error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/projects/:id/tasks — create task (admin only)
router.post('/projects/:id/tasks', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { title, description, status, priority, due_date, assigned_to, assignee_ids } = req.body;

    const reqErr = validateRequired(['title'], req.body);
    if (reqErr) return res.status(400).json({ error: reqErr });

    const statusErr = validateEnum(status, ['todo', 'in_progress', 'done'], 'Status');
    if (statusErr) return res.status(400).json({ error: statusErr });

    const priorityErr = validateEnum(priority, ['low', 'medium', 'high'], 'Priority');
    if (priorityErr) return res.status(400).json({ error: priorityErr });

    // Determine assignee list
    const assignees = assignee_ids && assignee_ids.length > 0
      ? assignee_ids.map(Number)
      : (assigned_to ? [parseInt(assigned_to)] : []);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO tasks (title, description, status, priority, due_date, project_id, assigned_to, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          title.trim(),
          description || '',
          status || 'todo',
          priority || 'medium',
          due_date || null,
          req.params.id,
          assignees[0] || null,
          req.user.id
        ]
      );

      const task = result.rows[0];

      // Sync assignees
      await syncAssignees(client, task.id, req.params.id, assignees);

      await client.query('COMMIT');

      // Fetch with assignees
      const [enriched] = await attachAssignees([task]);
      res.status(201).json({ task: enriched });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/tasks/:id
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

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [task.project_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    const [enriched] = await attachAssignees([task]);
    res.json({ task: enriched, myRole: memberCheck.rows[0].role });
  } catch (err) {
    console.error('Get task error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/tasks/:id — update task
router.put('/tasks/:id', authenticate, async (req, res) => {
  try {
    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const task = taskResult.rows[0];

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [task.project_id, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    const userRole = memberCheck.rows[0].role;
    const { title, description, status, priority, due_date, assigned_to, assignee_ids } = req.body;

    if (userRole === 'member') {
      if (title || description || priority || due_date || assigned_to !== undefined || assignee_ids !== undefined) {
        return res.status(403).json({ error: 'Members can only update task status.' });
      }

      const statusErr = validateEnum(status, ['todo', 'in_progress', 'done'], 'Status');
      if (statusErr) return res.status(400).json({ error: statusErr });

      const result = await pool.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );

      const [enriched] = await attachAssignees([result.rows[0]]);
      return res.json({ task: enriched });
    }

    // Admin: full update
    const statusErr = validateEnum(status, ['todo', 'in_progress', 'done'], 'Status');
    if (statusErr) return res.status(400).json({ error: statusErr });

    const priorityErr = validateEnum(priority, ['low', 'medium', 'high'], 'Priority');
    if (priorityErr) return res.status(400).json({ error: priorityErr });

    // Determine assignees
    const assignees = assignee_ids !== undefined
      ? (assignee_ids || []).map(Number)
      : (assigned_to ? [parseInt(assigned_to)] : []);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
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
          assignees[0] || null,
          req.params.id
        ]
      );

      await syncAssignees(client, task.id, task.project_id, assignees);
      await client.query('COMMIT');

      const [enriched] = await attachAssignees([result.rows[0]]);
      res.json({ task: enriched });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', authenticate, async (req, res) => {
  try {
    const taskResult = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [req.params.id]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }

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
