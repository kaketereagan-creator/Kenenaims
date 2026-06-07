const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole, auditLog } = require('../middleware/auth');

// GET /api/wallet/balances
router.get('/balances', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM wallets WHERE is_active = true ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/wallet/inject - Super Admin only
router.post('/inject', authenticate, requireRole('super_admin'),
  auditLog('CAPITAL_INJECTION', 'wallet'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { wallet_id, amount, currency, description } = req.body;

    const wallet = await client.query(
      'SELECT * FROM wallets WHERE id = $1 FOR UPDATE', [wallet_id]
    );
    if (!wallet.rows[0]) return res.status(404).json({ error: 'Wallet not found' });

    const balanceBefore = parseFloat(wallet.rows[0].balance);
    const balanceAfter = balanceBefore + parseFloat(amount);

    await client.query(
      'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2',
      [balanceAfter, wallet_id]
    );

    const txn = await client.query(`
      INSERT INTO wallet_transactions
        (wallet_id, transaction_type, direction, amount, currency,
         balance_before, balance_after, description, created_by, approved_by, approved_at)
      VALUES ($1,'capital_injection','credit',$2,$3,$4,$5,$6,$7,$7,NOW())
      RETURNING *
    `, [wallet_id, amount, currency || 'UGX', balanceBefore, balanceAfter, description, req.user.id]);

    await client.query('COMMIT');
    res.status(201).json(txn.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/wallet/request-expense
router.post('/request-expense', authenticate, async (req, res) => {
  try {
    const { amount, currency, purpose, expense_category_id } = req.body;

    const result = await pool.query(`
      INSERT INTO expense_requests (requested_by, amount, currency, purpose, expense_category_id)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [req.user.id, amount, currency || 'UGX', purpose, expense_category_id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/wallet/approve-expense/:id - Super Admin only
router.post('/approve-expense/:id', authenticate, requireRole('super_admin'),
  auditLog('APPROVE_EXPENSE', 'wallet'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const request = await client.query(
      'SELECT * FROM expense_requests WHERE id = $1 AND status = $2',
      [req.params.id, 'pending']
    );
    if (!request.rows[0]) return res.status(404).json({ error: 'Request not found or already processed' });

    const req_data = request.rows[0];
    const wallet = await client.query(
      `SELECT * FROM wallets WHERE currency = $1 FOR UPDATE`, [req_data.currency]
    );

    if (!wallet.rows[0] || parseFloat(wallet.rows[0].balance) < parseFloat(req_data.amount)) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const balanceBefore = parseFloat(wallet.rows[0].balance);
    const balanceAfter = balanceBefore - parseFloat(req_data.amount);

    await client.query(
      'UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2',
      [balanceAfter, wallet.rows[0].id]
    );

    const txn = await client.query(`
      INSERT INTO wallet_transactions
        (wallet_id, transaction_type, direction, amount, currency,
         balance_before, balance_after, description, created_by, approved_by, approved_at)
      VALUES ($1,'expense','debit',$2,$3,$4,$5,$6,$7,$7,NOW())
      RETURNING *
    `, [wallet.rows[0].id, req_data.amount, req_data.currency,
        balanceBefore, balanceAfter, req_data.purpose, req.user.id]);

    await client.query(
      `UPDATE expense_requests SET status='approved', approved_by=$1, approved_at=NOW(),
       wallet_transaction_id=$2 WHERE id=$3`,
      [req.user.id, txn.rows[0].id, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Expense approved', transaction: txn.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/wallet/transactions
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { wallet_id, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT wt.*, u.full_name as created_by_name
      FROM wallet_transactions wt
      LEFT JOIN users u ON wt.created_by = u.id
      WHERE ($1::integer IS NULL OR wt.wallet_id = $1)
      ORDER BY wt.created_at DESC
      LIMIT $2 OFFSET $3
    `, [wallet_id || null, limit, offset]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// POST /api/wallet/reject-expense/:id — Super Admin only
router.post('/reject-expense/:id', authenticate, requireRole('super_admin'),
  auditLog('REJECT_EXPENSE', 'wallet'), async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await pool.query(`
      UPDATE expense_requests
      SET status='rejected', approved_by=$1, approved_at=NOW(), rejection_reason=$2
      WHERE id=$3 AND status='pending'
      RETURNING *
    `, [req.user.id, reason || null, req.params.id]);

    if (!result.rows[0])
      return res.status(404).json({ error: 'Request not found or already processed' });

    // Notify requester
    try {
      const { createNotification } = require('../services/notifications');
      await createNotification(
        result.rows[0].requested_by,
        '❌ Expense Request Rejected',
        `Your request was rejected${reason ? `: ${reason}` : ''}. Contact admin for details.`,
        'expense_rejected', 'expense_request', req.params.id
      );
    } catch (e) {}

    res.json({ message: 'Request rejected', request: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/wallet/pending-requests — pending expense requests queue
router.get('/pending-requests', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT er.*, u.full_name as requested_by_name, u.email as requested_by_email,
             ec.name as category_name
      FROM expense_requests er
      LEFT JOIN users u ON er.requested_by = u.id
      LEFT JOIN expense_categories ec ON er.expense_category_id = ec.id
      WHERE er.status = 'pending'
      ORDER BY er.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
