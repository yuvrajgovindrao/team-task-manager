const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard — aggregated stats for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all project IDs the user is a member of
    const projectsResult = await pool.query(
      'SELECT project_id FROM project_members WHERE user_id = $1',
      [userId]
    );

    const projectIds = projectsResult.rows.map(r => r.project_id);

    if (projectIds.length === 0) {
      return res.json({
        totalProjects: 0,
        totalTasks: 0,
        tasksByStatus: { todo: 0, in_progress: 0, done: 0 },
        overdueTasks: [],
        recentTasks: [],
        myTasks: []
      });
    }

    // Total projects
    const totalProjects = projectIds.length;

    // Tasks stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'todo') as todo,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'done') as done
       FROM tasks WHERE project_id = ANY($1)`,
      [projectIds]
    );

    const stats = statsResult.rows[0];

    // Overdue tasks (due_date < today and not done)
    const overdueResult = await pool.query(
      `SELECT t.*, p.name as project_name, u.name as assigned_to_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.project_id = ANY($1)
         AND t.due_date < CURRENT_DATE
         AND t.status != 'done'
       ORDER BY t.due_date ASC
       LIMIT 10`,
      [projectIds]
    );

    // Recent tasks (last 10)
    const recentResult = await pool.query(
      `SELECT t.*, p.name as project_name, u.name as assigned_to_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.project_id = ANY($1)
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [projectIds]
    );

    // Tasks assigned to me
    const myTasksResult = await pool.query(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.assigned_to = $1 AND t.status != 'done'
       ORDER BY t.due_date ASC NULLS LAST, t.priority DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      totalProjects,
      totalTasks: parseInt(stats.total),
      tasksByStatus: {
        todo: parseInt(stats.todo),
        in_progress: parseInt(stats.in_progress),
        done: parseInt(stats.done)
      },
      overdueTasks: overdueResult.rows,
      recentTasks: recentResult.rows,
      myTasks: myTasksResult.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
