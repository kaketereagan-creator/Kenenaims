const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole, auditLog } = require('../middleware/auth');

// ── INCOME ────────────────────────────────────────────────────────────────────

// GET /api/finance/income
router.get('/income', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, category_id, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = 'WHERE 1=1';

    if (start_date) { params.push(start_date); where += ` AND t.transaction_date >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND t.transaction_date <= $${params.length}`; }
    if (category_id) { params.push(category_id); where += ` AND t.category_id = $${params.length}`; }

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT t.*, ic.name as category_name, u.full_name as received_by_name
      FROM income_transactions t
      LEFT JOIN income_categories ic ON t.category_id = ic.id
      LEFT JOIN users u ON t.received_by = u.id
      ${where}
      ORDER BY t.transaction_date DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    const total = await pool.query(
      `SELECT COUNT(*), SUM(amount) as total_amount FROM income_transactions t ${where}`,
      params.slice(0,-2)
    );

    res.json({
      transactions: result.rows,
      count: parseInt(total.rows[0].count),
      total_amount: parseFloat(total.rows[0].total_amount) || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/finance/income
router.post('/income', authenticate, auditLog('RECORD_INCOME', 'finance'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { category_id, amount, currency, description, reference_type, reference_id, transaction_date, payment_method, notes } = req.body;

    const result = await client.query(`
      INSERT INTO income_transactions
        (category_id, amount, currency, description, reference_type, reference_id,
         transaction_date, payment_method, received_by, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [category_id, amount, currency || 'UGX', description, reference_type,
        reference_id, transaction_date, payment_method, req.user.id, notes]);

    // Credit wallet automatically
    const wallet = await client.query(
      'SELECT * FROM wallets WHERE currency = $1 FOR UPDATE', [currency || 'UGX']
    );
    if (wallet.rows[0]) {
      const newBalance = parseFloat(wallet.rows[0].balance) + parseFloat(amount);
      await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, wallet.rows[0].id]);
      await client.query(`
        INSERT INTO wallet_transactions
          (wallet_id, transaction_type, direction, amount, currency,
           balance_before, balance_after, description, created_by, approved_by, approved_at)
        VALUES ($1,'income','credit',$2,$3,$4,$5,$6,$7,$7,NOW())
      `, [wallet.rows[0].id, amount, currency || 'UGX',
          wallet.rows[0].balance, newBalance, description, req.user.id]);
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── EXPENSES ──────────────────────────────────────────────────────────────────

// GET /api/finance/expenses
router.get('/expenses', authenticate, async (req, res) => {
  try {
    const { start_date, end_date, category_id, status, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = 'WHERE 1=1';

    if (start_date) { params.push(start_date); where += ` AND t.transaction_date >= $${params.length}`; }
    if (end_date) { params.push(end_date); where += ` AND t.transaction_date <= $${params.length}`; }
    if (category_id) { params.push(category_id); where += ` AND t.category_id = $${params.length}`; }
    if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT t.*, ec.name as category_name, u.full_name as created_by_name,
             a.full_name as approved_by_name
      FROM expense_transactions t
      LEFT JOIN expense_categories ec ON t.category_id = ec.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users a ON t.approved_by = a.id
      ${where}
      ORDER BY t.transaction_date DESC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    const total = await pool.query(
      `SELECT COUNT(*), SUM(amount) as total_amount FROM expense_transactions t ${where}`,
      params.slice(0,-2)
    );

    res.json({
      transactions: result.rows,
      count: parseInt(total.rows[0].count),
      total_amount: parseFloat(total.rows[0].total_amount) || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/finance/expenses
router.post('/expenses', authenticate, auditLog('RECORD_EXPENSE', 'finance'), async (req, res) => {
  try {
    const { category_id, amount, currency, description, payee_name, transaction_date, payment_method, notes } = req.body;

    const result = await pool.query(`
      INSERT INTO expense_transactions
        (category_id, amount, currency, description, payee_name,
         transaction_date, payment_method, status, created_by, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',$8,$9) RETURNING *
    `, [category_id, amount, currency || 'UGX', description, payee_name,
        transaction_date, payment_method, req.user.id, notes]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── REPORTS ───────────────────────────────────────────────────────────────────

// GET /api/finance/report/pl?month=2025-06
router.get('/report/pl', authenticate, async (req, res) => {
  try {
    const { month, year } = req.query;
    let startDate, endDate;

    if (month) {
      startDate = `${month}-01`;
      const [y, m] = month.split('-');
      endDate = new Date(y, m, 0).toISOString().split('T')[0];
    } else if (year) {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    } else {
      const now = new Date();
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    // Income by category
    const incomeByCategory = await pool.query(`
      SELECT ic.name as category, SUM(t.amount) as total
      FROM income_transactions t
      JOIN income_categories ic ON t.category_id = ic.id
      WHERE t.transaction_date BETWEEN $1 AND $2
      GROUP BY ic.name ORDER BY total DESC
    `, [startDate, endDate]);

    // Expenses by category
    const expenseByCategory = await pool.query(`
      SELECT ec.name as category, SUM(t.amount) as total
      FROM expense_transactions t
      JOIN expense_categories ec ON t.category_id = ec.id
      WHERE t.transaction_date BETWEEN $1 AND $2 AND t.status = 'paid'
      GROUP BY ec.name ORDER BY total DESC
    `, [startDate, endDate]);

    const totalIncome = incomeByCategory.rows.reduce((s, r) => s + parseFloat(r.total), 0);
    const totalExpenses = expenseByCategory.rows.reduce((s, r) => s + parseFloat(r.total), 0);

    // Previous period comparison
    const prevStart = new Date(startDate);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(endDate);
    prevEnd.setMonth(prevEnd.getMonth() - 1);

    const prevIncome = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM income_transactions WHERE transaction_date BETWEEN $1 AND $2`,
      [prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]]
    );
    const prevExpenses = await pool.query(
      `SELECT COALESCE(SUM(amount),0) as total FROM expense_transactions WHERE transaction_date BETWEEN $1 AND $2 AND status='paid'`,
      [prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]]
    );

    const prevTotalIncome = parseFloat(prevIncome.rows[0].total);
    const prevTotalExpenses = parseFloat(prevExpenses.rows[0].total);

    res.json({
      period: { start: startDate, end: endDate },
      income: {
        by_category: incomeByCategory.rows,
        total: totalIncome,
        vs_previous: prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome * 100).toFixed(1) : null
      },
      expenses: {
        by_category: expenseByCategory.rows,
        total: totalExpenses,
        vs_previous: prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses * 100).toFixed(1) : null
      },
      net_profit: totalIncome - totalExpenses,
      profit_margin: totalIncome > 0 ? (((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1) : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/finance/report/cashflow?months=6
router.get('/report/cashflow', authenticate, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', d), 'Mon YYYY') as period,
        DATE_TRUNC('month', d) as period_date,
        COALESCE(i.income, 0) as income,
        COALESCE(e.expenses, 0) as expenses,
        COALESCE(i.income, 0) - COALESCE(e.expenses, 0) as net
      FROM generate_series(
        DATE_TRUNC('month', CURRENT_DATE - ($1 || ' months')::interval),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'
      ) d
      LEFT JOIN (
        SELECT DATE_TRUNC('month', transaction_date) as m, SUM(amount) as income
        FROM income_transactions GROUP BY m
      ) i ON i.m = d
      LEFT JOIN (
        SELECT DATE_TRUNC('month', transaction_date) as m, SUM(amount) as expenses
        FROM expense_transactions WHERE status='paid' GROUP BY m
      ) e ON e.m = d
      ORDER BY d
    `, [months - 1]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/finance/report/enterprise - profitability by enterprise
router.get('/report/enterprise', authenticate, async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const result = await pool.query(`
      SELECT
        ic.name as enterprise,
        COALESCE(SUM(t.amount), 0) as revenue
      FROM income_transactions t
      JOIN income_categories ic ON t.category_id = ic.id
      WHERE EXTRACT(YEAR FROM t.transaction_date) = $1
      GROUP BY ic.name
      ORDER BY revenue DESC
    `, [year]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/finance/categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const income = await pool.query('SELECT * FROM income_categories ORDER BY name');
    const expense = await pool.query('SELECT * FROM expense_categories ORDER BY name');
    res.json({ income: income.rows, expense: expense.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
