const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole, auditLog } = require('../middleware/auth');

// GET /api/crops/fields
router.get('/fields', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*,
        cc.id as cycle_id, ct.name as crop_type, cc.status,
        cc.planting_date, cc.expected_harvest_date, cc.actual_harvest_date,
        cc.expected_yield, cc.actual_yield, cc.yield_unit, cc.notes as cycle_notes
      FROM fields f
      LEFT JOIN crop_cycles cc ON cc.field_id = f.id
        AND cc.status NOT IN ('failed')
        AND cc.created_at = (SELECT MAX(c2.created_at) FROM crop_cycles c2 WHERE c2.field_id = f.id)
      LEFT JOIN crop_types ct ON cc.crop_type_id = ct.id
      WHERE f.is_active = true
      ORDER BY f.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crops/fields
router.post('/fields', authenticate, requireRole('super_admin', 'farm_manager'),
  auditLog('CREATE_FIELD', 'crops'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { field_name, acreage, gps_lat, gps_lng, notes } = req.body;

    const count = await client.query('SELECT COUNT(*) FROM fields');
    const field_code = `FLD-${String(parseInt(count.rows[0].count) + 1).padStart(3, '0')}`;

    const field = await client.query(`
      INSERT INTO fields (field_name, field_code, acreage, gps_lat, gps_lng, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [field_name, field_code, acreage, gps_lat, gps_lng, notes]);

    await client.query('COMMIT');
    res.status(201).json(field.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/crops/fields/:id/cycle — start a new planting cycle
router.post('/fields/:id/cycle', authenticate, requireRole('super_admin', 'farm_manager'), async (req, res) => {
  try {
    const { crop_type_id, season, planting_date, expected_harvest_date, expected_yield, yield_unit, notes } = req.body;
    const result = await pool.query(`
      INSERT INTO crop_cycles
        (field_id, crop_type_id, season, planting_date, expected_harvest_date,
         expected_yield, yield_unit, status, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'planted',$8,$9) RETURNING *
    `, [req.params.id, crop_type_id, season, planting_date, expected_harvest_date,
        expected_yield, yield_unit || 'kg', notes, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/crops/:id/harvest — record a harvest
router.post('/:id/harvest', authenticate, auditLog('RECORD_HARVEST', 'crops'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { actual_yield, yield_unit, sale_price_per_unit, buyer_name, actual_harvest_date, notes } = req.body;
    const total_revenue = parseFloat(actual_yield || 0) * parseFloat(sale_price_per_unit || 0);

    const result = await client.query(`
      UPDATE crop_cycles SET
        actual_yield = $1, yield_unit = $2,
        actual_harvest_date = $3, revenue = $4,
        status = 'harvested', notes = COALESCE($5, notes)
      WHERE id = $6 RETURNING *
    `, [actual_yield, yield_unit || 'kg', actual_harvest_date || new Date(), total_revenue, notes, req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Cycle not found' });

    // Record income transaction if revenue > 0
    if (total_revenue > 0) {
      await client.query(`
        INSERT INTO income_transactions
          (category_id, amount, currency, description, reference_type, reference_id, transaction_date, received_by)
        SELECT id, $1, 'UGX', $2, 'crop_cycle', $3, $4, $5
        FROM income_categories WHERE name = 'Crop Sales' LIMIT 1
      `, [total_revenue, `Harvest — ${buyer_name || 'Farm produce'}`, req.params.id, actual_harvest_date || new Date(), req.user.id]);
    }

    await client.query('COMMIT');
    res.json({ ...result.rows[0], total_revenue });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/crops/:id/activity — log a farm activity
router.post('/:id/activity', authenticate, async (req, res) => {
  try {
    const { activity_type, activity_date, labour_cost, material_used, material_cost, performed_by, notes } = req.body;
    const result = await pool.query(`
      INSERT INTO crop_activities
        (crop_cycle_id, activity_type, activity_date, labour_cost, material_used,
         material_cost, performed_by, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [req.params.id, activity_type, activity_date || new Date(), labour_cost || 0,
        material_used, material_cost || 0, performed_by, notes, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/crops/types
router.get('/types', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crop_types ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
