const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, requireRole, auditLog } = require('../middleware/auth');

// GET /api/inventory/items
router.get('/items', authenticate, async (req, res) => {
  try {
    const { category, low_stock, search, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = 'WHERE i.is_active = true';

    if (category) { params.push(category); where += ` AND ic.name ILIKE $${params.length}`; }
    if (low_stock === 'true') where += ` AND i.current_stock <= i.reorder_level`;
    if (search) { params.push(`%${search}%`); where += ` AND i.name ILIKE $${params.length}`; }

    params.push(limit, offset);
    const result = await pool.query(`
      SELECT i.*, ic.name as category_name, s.name as supplier_name,
        CASE WHEN i.current_stock <= 0 THEN 'out_of_stock'
             WHEN i.current_stock <= i.reorder_level THEN 'low'
             ELSE 'ok' END as stock_status,
        CASE WHEN i.expiry_date IS NOT NULL AND i.expiry_date <= CURRENT_DATE + 30 THEN true ELSE false END as expiring_soon
      FROM inventory_items i
      LEFT JOIN inventory_categories ic ON i.category_id = ic.id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      ${where}
      ORDER BY stock_status ASC, i.name ASC
      LIMIT $${params.length-1} OFFSET $${params.length}
    `, params);

    const count = await pool.query(
      `SELECT COUNT(*) FROM inventory_items i LEFT JOIN inventory_categories ic ON i.category_id = ic.id ${where}`,
      params.slice(0, -2)
    );

    // Summary stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(CASE WHEN current_stock <= reorder_level AND current_stock > 0 THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN expiry_date <= CURRENT_DATE + 30 AND expiry_date IS NOT NULL THEN 1 END) as expiring_soon_count
      FROM inventory_items WHERE is_active = true
    `);

    res.json({
      items: result.rows,
      total: parseInt(count.rows[0].count),
      stats: stats.rows[0],
      page: parseInt(page),
      pages: Math.ceil(count.rows[0].count / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/categories
router.get('/categories', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/items
router.post('/items', authenticate, requireRole('super_admin', 'farm_manager', 'storekeeper'),
  auditLog('CREATE_ITEM', 'inventory'), async (req, res) => {
  try {
    const {
      name, category_id, unit, current_stock, reorder_level,
      unit_cost, expiry_date, storage_location, supplier_id, notes
    } = req.body;

    const count = await pool.query('SELECT COUNT(*) FROM inventory_items');
    const item_code = `ITM-${String(parseInt(count.rows[0].count) + 1).padStart(4, '0')}`;

    const result = await pool.query(`
      INSERT INTO inventory_items
        (item_code, name, category_id, unit, current_stock, reorder_level,
         unit_cost, expiry_date, storage_location, supplier_id, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [item_code, name, category_id, unit, current_stock || 0, reorder_level || 0,
        unit_cost, expiry_date, storage_location, supplier_id, notes]);

    // Log initial stock as a purchase movement if stock > 0
    if (current_stock > 0) {
      await pool.query(`
        INSERT INTO inventory_movements
          (item_id, movement_type, quantity, unit_cost, total_cost, movement_date, notes, recorded_by)
        VALUES ($1,'purchase',$2,$3,$4,CURRENT_DATE,'Opening stock',$5)
      `, [result.rows[0].id, current_stock, unit_cost, (unit_cost || 0) * current_stock, req.user.id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/items/:id/restock - record a purchase
router.post('/items/:id/restock', authenticate,
  requireRole('super_admin', 'farm_manager', 'storekeeper', 'accountant'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity, unit_cost, invoice_number, supplier_id, notes, movement_date } = req.body;

    const item = await client.query('SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!item.rows[0]) return res.status(404).json({ error: 'Item not found' });

    const newStock = parseFloat(item.rows[0].current_stock) + parseFloat(quantity);
    await client.query(
      'UPDATE inventory_items SET current_stock = $1, unit_cost = COALESCE($2, unit_cost), updated_at = NOW() WHERE id = $3',
      [newStock, unit_cost, req.params.id]
    );

    const movement = await client.query(`
      INSERT INTO inventory_movements
        (item_id, movement_type, quantity, unit_cost, total_cost, invoice_number,
         supplier_id, movement_date, notes, recorded_by)
      VALUES ($1,'purchase',$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [req.params.id, quantity, unit_cost, (unit_cost || 0) * quantity,
        invoice_number, supplier_id, movement_date || new Date(), notes, req.user.id]);

    await client.query('COMMIT');
    res.json({ new_stock: newStock, movement: movement.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/inventory/items/:id/consume
router.post('/items/:id/consume', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity, reference_type, reference_id, notes, movement_date } = req.body;

    const item = await client.query('SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!item.rows[0]) return res.status(404).json({ error: 'Item not found' });
    if (parseFloat(item.rows[0].current_stock) < parseFloat(quantity)) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    const newStock = parseFloat(item.rows[0].current_stock) - parseFloat(quantity);
    await client.query('UPDATE inventory_items SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, req.params.id]);

    await client.query(`
      INSERT INTO inventory_movements
        (item_id, movement_type, quantity, reference_type, reference_id, movement_date, notes, recorded_by)
      VALUES ($1,'consumption',$2,$3,$4,$5,$6,$7)
    `, [req.params.id, quantity, reference_type, reference_id, movement_date || new Date(), notes, req.user.id]);

    // Check if now below reorder level - create notification
    if (newStock <= parseFloat(item.rows[0].reorder_level)) {
      await client.query(`
        INSERT INTO notifications (title, message, type, reference_type, reference_id)
        VALUES ($1,$2,'low_stock','inventory_item',$3)
      `, [
        `Low Stock: ${item.rows[0].name}`,
        `${item.rows[0].name} is low (${newStock} ${item.rows[0].unit} remaining). Reorder level: ${item.rows[0].reorder_level}`,
        req.params.id
      ]);
    }

    await client.query('COMMIT');
    res.json({ new_stock: newStock });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/inventory/movements
router.get('/movements', authenticate, async (req, res) => {
  try {
    const { item_id, type, days = 30 } = req.query;
    let where = `WHERE m.movement_date >= CURRENT_DATE - $1`;
    const params = [days];

    if (item_id) { params.push(item_id); where += ` AND m.item_id = $${params.length}`; }
    if (type) { params.push(type); where += ` AND m.movement_type = $${params.length}`; }

    const result = await pool.query(`
      SELECT m.*, i.name as item_name, i.unit, u.full_name as recorded_by_name
      FROM inventory_movements m
      JOIN inventory_items i ON m.item_id = i.id
      LEFT JOIN users u ON m.recorded_by = u.id
      ${where}
      ORDER BY m.movement_date DESC, m.created_at DESC
      LIMIT 100
    `, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inventory/suppliers
router.get('/suppliers', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers WHERE is_active = true ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory/suppliers
router.post('/suppliers', authenticate, requireRole('super_admin', 'farm_manager', 'storekeeper'), async (req, res) => {
  try {
    const { name, phone, email, address, category } = req.body;
    const result = await pool.query(
      'INSERT INTO suppliers (name, phone, email, address, category) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, phone, email, address, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
