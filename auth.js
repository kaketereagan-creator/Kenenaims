const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      `SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=$1`,
      [decoded.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });

    // REAL-TIME SUSPEND CHECK: if session_version in token < current, token is dead
    if (!user.is_active)
      return res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });

    if (decoded.session_version && user.session_version && decoded.session_version < user.session_version)
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_INVALIDATED' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role_name))
    return res.status(403).json({ error: 'Insufficient permissions', required: roles, current: req.user.role_name });
  next();
};

const auditLog = (action, module) => async (req, res, next) => {
  res.on('finish', async () => {
    if (req.user && res.statusCode < 400) {
      try {
        await pool.query(
          `INSERT INTO audit_logs (user_id,action,module,record_id,ip_address,user_agent) VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.user.id, action, module, req.params.id || null, req.ip, req.headers['user-agent']]
        );
      } catch (e) {}
    }
  });
  next();
};

module.exports = { authenticate, requireRole, auditLog };
