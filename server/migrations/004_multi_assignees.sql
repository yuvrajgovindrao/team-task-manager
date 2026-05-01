-- 004_multi_assignees.sql

-- Junction table for many-to-many task assignments
CREATE TABLE IF NOT EXISTS task_assignees (
  id         SERIAL PRIMARY KEY,
  task_id    INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);

-- Migrate existing assigned_to data into the new table
INSERT INTO task_assignees (task_id, user_id)
SELECT id, assigned_to FROM tasks WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;
