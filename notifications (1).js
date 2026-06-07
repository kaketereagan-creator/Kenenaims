const router = require('express').Router();
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { checkVaccinationsDue, checkLowStock } = require('../services/notifications');

// GET /api/notifications — get current user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 30, unread_only } = req.query;
    let where = 'WHERE (n.user_id = $1 OR n.user_id IS NULL)';
    if (unread_only === 'true') where += ' AND n.is_read = false';

    const result = await pool.query(`
      SELECT n.*
      FROM notifications n
      ${where}
      ORDER BY n.created_at DESC
      LIMIT $2
    `, [req.user.id, limit]);

    const unread = await pool.query(
      `SELECT COUNT(*) FROM notifications WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`,
      [req.user.id]
    );

    res.json({ notifications: result.rows, unread_count: parseInt(unread.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all/mark', authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true, read_at = NOW() WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/run-checks — manual trigger (admin only)
router.post('/run-checks', authenticate, async (req, res) => {
  try {
    await Promise.allSettled([checkVaccinationsDue(), checkLowStock()]);
    res.json({ message: 'Notification checks triggered' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
