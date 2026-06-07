const router = require('express').Router();
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [
      livestock,
      employees,
      finance,
      wallet,
      alerts
    ] = await Promise.all([
      // Livestock counts
      pool.query(`
        SELECT
          SUM(CASE WHEN sp.name='rabbit' THEN 1 ELSE 0 END) AS rabbits,
          SUM(CASE WHEN sp.name='pig' THEN 1 ELSE 0 END) AS pigs,
          SUM(CASE WHEN sp.name='poultry' THEN 1 ELSE 0 END) AS poultry,
          SUM(CASE WHEN sp.name='cattle' THEN 1 ELSE 0 END) AS cattle
        FROM animals a
        JOIN animal_species sp ON a.species_id = sp.id
        WHERE a.status = 'active' AND a.deleted_at IS NULL
      `),

      // Employee count
      pool.query(`SELECT COUNT(*) as total FROM employees WHERE is_active = true AND deleted_at IS NULL`),

      // Monthly finance
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN type='income' THEN amount END), 0) AS monthly_income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount END), 0) AS monthly_expenses
        FROM (
          SELECT amount, 'income' as type FROM income_transactions
          WHERE DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
          UNION ALL
          SELECT amount, 'expense' as type FROM expense_transactions
          WHERE DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)
          AND status = 'paid'
        ) t
      `),

      // Wallet balance (UGX main)
      pool.query(`SELECT balance FROM wallets WHERE currency = 'UGX' LIMIT 1`),

      // Alerts
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM vaccination_records WHERE next_due_date <= CURRENT_DATE + 7) AS vaccinations_due,
          (SELECT COUNT(*) FROM inventory_items WHERE current_stock <= reorder_level AND is_active = true) AS low_stock,
          (SELECT COUNT(*) FROM expense_requests WHERE status = 'pending') AS pending_approvals,
          (SELECT COUNT(*) FROM animals WHERE status = 'active' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) AS births_this_month,
          (SELECT COUNT(*) FROM animal_deaths WHERE DATE_TRUNC('month', death_date) = DATE_TRUNC('month', CURRENT_DATE)) AS deaths_this_month
      `)
    ]);

    const lv = livestock.rows[0];
    const fin = finance.rows[0];
    const al = alerts.rows[0];
    const walletBal = wallet.rows[0]?.balance || 0;
    const monthlyIncome = parseFloat(fin.monthly_income);
    const monthlyExpenses = parseFloat(fin.monthly_expenses);

    res.json({
      livestock: {
        rabbits: parseInt(lv.rabbits) || 0,
        pigs: parseInt(lv.pigs) || 0,
        poultry: parseInt(lv.poultry) || 0,
        cattle: parseInt(lv.cattle) || 0,
        total: (parseInt(lv.rabbits) || 0) + (parseInt(lv.pigs) || 0) +
               (parseInt(lv.poultry) || 0) + (parseInt(lv.cattle) || 0)
      },
      employees: parseInt(employees.rows[0].total) || 0,
      finance: {
        wallet_balance: parseFloat(walletBal),
        monthly_income: monthlyIncome,
        monthly_expenses: monthlyExpenses,
        net_profit: monthlyIncome - monthlyExpenses
      },
      alerts: {
        vaccinations_due: parseInt(al.vaccinations_due) || 0,
        low_stock: parseInt(al.low_stock) || 0,
        pending_approvals: parseInt(al.pending_approvals) || 0,
        births_this_month: parseInt(al.births_this_month) || 0,
        deaths_this_month: parseInt(al.deaths_this_month) || 0
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/revenue-trend
router.get('/revenue-trend', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', d), 'Mon YY') as month,
        COALESCE(i.income, 0) as income,
        COALESCE(e.expenses, 0) as expenses
      FROM generate_series(
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
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
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
