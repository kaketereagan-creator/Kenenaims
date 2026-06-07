const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate, requireRole, auditLog } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query(
      `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE LOWER(u.email) = $1`,
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.is_active) {
      await pool.query(`INSERT INTO audit_logs (user_id, action, module, ip_address) VALUES ($1,'LOGIN_BLOCKED_SUSPENDED','auth',$2)`, [user.id, req.ip]);
      return res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED', message: 'Your account has been suspended. Contact the farm administrator.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { userId: user.id, role: user.role_name, session_version: user.session_version || 1 },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await pool.query(`INSERT INTO audit_logs (user_id, action, module, ip_address, user_agent) VALUES ($1,'LOGIN_SUCCESS','auth',$2,$3)`, [user.id, req.ip, req.headers['user-agent']]);

    res.json({
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role_name, profile_photo: user.profile_photo, last_login: user.last_login }
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', authenticate, async (req, res) => {
  const { password_hash, ...user } = req.user;
  res.json(user);
});

router.post('/logout', authenticate, async (req, res) => {
  await pool.query(`INSERT INTO audit_logs (user_id, action, module) VALUES ($1,'LOGOUT','auth')`, [req.user.id]);
  res.json({ message: 'Logged out' });
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Min 8 characters' });
    const valid = await bcrypt.compare(current_password, req.user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/users', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.last_login, u.created_at, u.profile_photo, r.name as role_name
      FROM users u JOIN roles r ON u.role_id = r.id WHERE u.deleted_at IS NULL ORDER BY r.id, u.full_name
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/users', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { full_name, email, phone, role_name, password } = req.body;
    if (!full_name || !email || !role_name || !password) return res.status(400).json({ error: 'All fields required' });
    const exists = await pool.query('SELECT id FROM users WHERE LOWER(email)=$1', [email.toLowerCase()]);
    if (exists.rows[0]) return res.status(409).json({ error: 'Email already registered' });
    const role = await pool.query('SELECT id FROM roles WHERE name=$1', [role_name]);
    if (!role.rows[0]) return res.status(400).json({ error: 'Invalid role' });
    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (full_name,email,phone,role_id,password_hash,is_active,session_version) VALUES ($1,$2,$3,$4,$5,true,1) RETURNING id,full_name,email,phone,is_active,created_at`,
      [full_name, email.toLowerCase(), phone, role.rows[0].id, password_hash]
    );
    await pool.query(`INSERT INTO audit_logs (user_id,action,module,record_id) VALUES ($1,'CREATE_USER','users',$2)`, [req.user.id, result.rows[0].id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// REAL-TIME KILL SWITCH — bumps session_version to immediately invalidate all tokens
router.patch('/users/:id/suspend', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { suspend, reason } = req.body;
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot suspend your own account' });
    const result = await pool.query(
      `UPDATE users SET is_active=$1, session_version=session_version+1, updated_at=NOW() WHERE id=$2 RETURNING id,full_name,email,is_active,session_version`,
      [!suspend, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      `INSERT INTO audit_logs (user_id,action,module,record_id,new_value) VALUES ($1,$2,'users',$3,$4)`,
      [req.user.id, suspend ? 'SUSPEND_USER' : 'UNSUSPEND_USER', req.params.id, JSON.stringify({ reason, by: req.user.full_name })]
    );
    res.json({
      message: suspend ? `${result.rows[0].full_name} suspended — session immediately terminated.` : `${result.rows[0].full_name} reactivated.`,
      user: result.rows[0]
    });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/users/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { full_name, phone, role_name } = req.body;
    let roleId = null;
    if (role_name) {
      const role = await pool.query('SELECT id FROM roles WHERE name=$1', [role_name]);
      if (!role.rows[0]) return res.status(400).json({ error: 'Invalid role' });
      roleId = role.rows[0].id;
    }
    const result = await pool.query(
      `UPDATE users SET full_name=COALESCE($1,full_name),phone=COALESCE($2,phone),role_id=COALESCE($3,role_id),updated_at=NOW() WHERE id=$4 AND deleted_at IS NULL RETURNING id,full_name,email,phone,is_active`,
      [full_name, phone, roleId, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/audit-logs', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    const { page=1, limit=50, user_id } = req.query;
    const offset = (page-1)*limit;
    let where = 'WHERE 1=1'; const params = [];
    if (user_id) { params.push(user_id); where += ` AND al.user_id=$${params.length}`; }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT al.*, u.full_name, u.email, r.name as role_name FROM audit_logs al LEFT JOIN users u ON al.user_id=u.id LEFT JOIN roles r ON u.role_id=r.id ${where} ORDER BY al.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
