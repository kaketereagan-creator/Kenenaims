const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/payroll/employees
router.get('/employees', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY full_name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payroll/employees
router.post('/employees', authenticate, requireRole('super_admin', 'farm_manager'), async (req, res) => {
  try {
    const {
      full_name, national_id, phone, email, position, department,
      salary_type, salary_rate, hire_date, mobile_money_number, mobile_money_provider
    } = req.body;

    const count = await pool.query('SELECT COUNT(*) FROM employees');
    const employee_code = `EMP-${String(parseInt(count.rows[0].count) + 1).padStart(4, '0')}`;

    const result = await pool.query(`
      INSERT INTO employees (
        employee_code, full_name, national_id, phone, email,
        position, department, salary_type, salary_rate, hire_date,
        mobile_money_number, mobile_money_provider
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [employee_code, full_name, national_id, phone, email,
        position, department, salary_type, salary_rate, hire_date,
        mobile_money_number, mobile_money_provider]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payroll/attendance
router.post('/attendance', authenticate, async (req, res) => {
  try {
    const { employee_id, date, time_in, time_out, hours_worked, overtime_hours, status, notes } = req.body;

    const result = await pool.query(`
      INSERT INTO attendance (employee_id, date, time_in, time_out, hours_worked, overtime_hours, status, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (employee_id, date) DO UPDATE SET
        time_in=EXCLUDED.time_in, time_out=EXCLUDED.time_out,
        hours_worked=EXCLUDED.hours_worked, status=EXCLUDED.status
      RETURNING *
    `, [employee_id, date, time_in, time_out, hours_worked, overtime_hours || 0, status, notes, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payroll/run - calculate payroll for a period
router.post('/run', authenticate, requireRole('super_admin', 'accountant'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { period_name, start_date, end_date, payment_date } = req.body;

    const period = await client.query(`
      INSERT INTO payroll_periods (period_name, start_date, end_date, payment_date)
      VALUES ($1,$2,$3,$4) RETURNING *
    `, [period_name, start_date, end_date, payment_date]);

    const employees = await client.query(
      `SELECT * FROM employees WHERE is_active = true AND deleted_at IS NULL`
    );

    const records = [];
    for (const emp of employees.rows) {
      const attendance = await client.query(`
        SELECT SUM(hours_worked) as total_hours, SUM(overtime_hours) as total_overtime,
               COUNT(CASE WHEN status='present' THEN 1 END) as days_present
        FROM attendance
        WHERE employee_id = $1 AND date BETWEEN $2 AND $3
      `, [emp.id, start_date, end_date]);

      const att = attendance.rows[0];
      let base_pay = 0;
      const rate = parseFloat(emp.salary_rate);

      if (emp.salary_type === 'daily') {
        base_pay = rate * (parseInt(att.days_present) || 0);
      } else if (emp.salary_type === 'weekly') {
        const weeks = Math.ceil((new Date(end_date) - new Date(start_date)) / (7 * 24 * 60 * 60 * 1000));
        base_pay = rate * weeks;
      } else {
        base_pay = rate;
      }

      const overtime_pay = (parseFloat(att.total_overtime) || 0) * (rate / 8) * 1.5;
      const gross_pay = base_pay + overtime_pay;

      // Check advances
      const advances = await client.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM salary_advances
        WHERE employee_id = $1 AND repayment_period_id IS NULL AND status = 'approved'
      `, [emp.id]);
      const advance_deduction = parseFloat(advances.rows[0].total);
      const net_pay = gross_pay - advance_deduction;

      const record = await client.query(`
        INSERT INTO payroll_records
          (period_id, employee_id, base_pay, overtime_pay, advance_deduction, gross_pay, net_pay)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
      `, [period.rows[0].id, emp.id, base_pay, overtime_pay, advance_deduction, gross_pay, net_pay]);

      records.push(record.rows[0]);
    }

    await client.query('COMMIT');
    res.json({ period: period.rows[0], records, total_records: records.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
