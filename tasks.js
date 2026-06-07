const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/tasks
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, assigned_to, date } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (req.user.role_name === 'worker') {
      params.push(req.user.id);
      where += ` AND assigned_user_id = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT t.*, u.full_name as assigned_to_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_user_id = u.id
      ${where}
      ORDER BY
        CASE WHEN t.due_date < CURRENT_DATE AND t.status != 'completed' THEN 0 ELSE 1 END,
        t.priority_order ASC,
        t.due_date ASC
    `, params);

    res.json(result.rows);
  } catch (err) {
    // Return demo data if table doesn't exist yet
    res.json([]);
  }
});

// POST /api/tasks
router.post('/', authenticate, requireRole('super_admin', 'farm_manager'), async (req, res) => {
  try {
    const { title, description, category, due_date, priority, assigned_user_id } = req.body;
    const result = await pool.query(`
      INSERT INTO tasks (title, description, category, due_date, priority, assigned_user_id, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,'pending',$7) RETURNING *
    `, [title, description, category, due_date, priority, assigned_user_id, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tasks/:id/complete
router.patch('/:id/complete', authenticate, async (req, res) => {
  try {
    const { completed_at, notes } = req.body;
    const result = await pool.query(`
      UPDATE tasks SET status='completed', completed_at=$1, completion_notes=$2, completed_by=$3, updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [completed_at || new Date(), notes, req.user.id, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
