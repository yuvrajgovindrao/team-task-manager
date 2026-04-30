const { pool } = require('../config/db');

// Middleware factory: checks if the authenticated user has one of the required roles
// for the project identified by req.params.id or req.params.projectId
function requireRole(...roles) {
  return async (req, res, next) => {
    const projectId = req.params.id || req.params.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    try {
      const result = await pool.query(
        'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this project.' });
      }

      const userRole = result.rows[0].role;

      if (!roles.includes(userRole)) {
        return res.status(403).json({ error: `Requires one of: ${roles.join(', ')}. You are: ${userRole}.` });
      }

      req.projectRole = userRole;
      next();
    } catch (err) {
      console.error('Role check error:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
}

// Middleware: just checks if the user is a member of the project (any role)
function requireMember() {
  return requireRole('admin', 'member');
}

module.exports = { requireRole, requireMember };
