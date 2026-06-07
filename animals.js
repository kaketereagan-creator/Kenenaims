const router = require('express').Router();
const pool = require('../config/db');
const { authenticate, auditLog } = require('../middleware/auth');
const QRCode = require('qrcode');

// Generate unique animal ID
async function generateAnimalId(speciesName) {
  const result = await pool.query(
    `UPDATE animal_species SET id_sequence = id_sequence + 1
     WHERE name = $1 RETURNING id_prefix, id_sequence`,
    [speciesName]
  );
  const { id_prefix, id_sequence } = result.rows[0];
  return `${id_prefix}-${String(id_sequence).padStart(6, '0')}`;
}

// GET /api/animals?species=rabbit&status=active&page=1&limit=20
router.get('/', authenticate, async (req, res) => {
  try {
    const { species, status, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE a.deleted_at IS NULL';
    const params = [];

    if (species) {
      params.push(species);
      whereClause += ` AND sp.name = $${params.length}`;
    }
    if (status) {
      params.push(status);
      whereClause += ` AND a.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (a.animal_id ILIKE $${params.length} OR a.name ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const result = await pool.query(`
      SELECT a.*, sp.name as species_name, sp.id_prefix,
             b.name as breed_name, h.unit_name as housing_name
      FROM animals a
      LEFT JOIN animal_species sp ON a.species_id = sp.id
      LEFT JOIN breeds b ON a.breed_id = b.id
      LEFT JOIN housing_units h ON a.housing_unit_id = h.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM animals a
       LEFT JOIN animal_species sp ON a.species_id = sp.id
       ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      animals: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/animals/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, sp.name as species_name, b.name as breed_name,
             h.unit_name as housing_name,
             m.animal_id as mother_animal_id, f.animal_id as father_animal_id
      FROM animals a
      LEFT JOIN animal_species sp ON a.species_id = sp.id
      LEFT JOIN breeds b ON a.breed_id = b.id
      LEFT JOIN housing_units h ON a.housing_unit_id = h.id
      LEFT JOIN animals m ON a.mother_id = m.id
      LEFT JOIN animals f ON a.father_id = f.id
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Animal not found' });

    // Get vaccinations
    const vaccinations = await pool.query(
      `SELECT vr.*, v.name as vaccine_name FROM vaccination_records vr
       JOIN vaccines v ON vr.vaccine_id = v.id
       WHERE vr.animal_id = $1 ORDER BY vr.date_given DESC`,
      [req.params.id]
    );

    // Get weight history
    const weights = await pool.query(
      `SELECT * FROM animal_weights WHERE animal_id = $1 ORDER BY recorded_date DESC LIMIT 10`,
      [req.params.id]
    );

    res.json({
      ...result.rows[0],
      vaccinations: vaccinations.rows,
      weight_history: weights.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/animals
router.post('/', authenticate, auditLog('CREATE_ANIMAL', 'livestock'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      species_name, breed_id, name, sex, date_of_birth,
      housing_unit_id, mother_id, father_id, current_weight,
      source, purchase_price, notes
    } = req.body;

    const speciesResult = await client.query(
      'SELECT * FROM animal_species WHERE name = $1', [species_name]
    );
    if (!speciesResult.rows[0])
      return res.status(400).json({ error: 'Invalid species' });

    const animal_id = await generateAnimalId(species_name);
    const qrData = JSON.stringify({ type: 'animal', id: animal_id, farm: 'KFMS' });
    const qr_code = await QRCode.toDataURL(qrData);

    const result = await client.query(`
      INSERT INTO animals (
        animal_id, species_id, breed_id, name, sex, date_of_birth,
        housing_unit_id, mother_id, father_id, current_weight,
        source, purchase_price, notes, qr_code, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      animal_id, speciesResult.rows[0].id, breed_id, name, sex, date_of_birth,
      housing_unit_id, mother_id, father_id, current_weight,
      source, purchase_price, notes, qr_code, req.user.id
    ]);

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PUT /api/animals/:id
router.put('/:id', authenticate, auditLog('UPDATE_ANIMAL', 'livestock'), async (req, res) => {
  try {
    const {
      name, sex, breed_id, housing_unit_id,
      current_weight, status, notes
    } = req.body;

    const result = await pool.query(`
      UPDATE animals SET
        name=$1, sex=$2, breed_id=$3, housing_unit_id=$4,
        current_weight=$5, status=$6, notes=$7, updated_at=NOW()
      WHERE id=$8 AND deleted_at IS NULL RETURNING *
    `, [name, sex, breed_id, housing_unit_id, current_weight, status, notes, req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Animal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/animals/:id/vaccinate
router.post('/:id/vaccinate', authenticate, async (req, res) => {
  try {
    const { vaccine_id, date_given, next_due_date, given_by, batch_number, notes } = req.body;

    const result = await pool.query(`
      INSERT INTO vaccination_records
        (animal_id, vaccine_id, date_given, next_due_date, given_by, batch_number, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [req.params.id, vaccine_id, date_given, next_due_date, given_by, batch_number, notes, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/animals/:id/weight
router.post('/:id/weight', authenticate, async (req, res) => {
  try {
    const { weight, weight_unit, recorded_date, notes } = req.body;

    await pool.query(
      'UPDATE animals SET current_weight=$1, updated_at=NOW() WHERE id=$2',
      [weight, req.params.id]
    );

    const result = await pool.query(`
      INSERT INTO animal_weights (animal_id, weight, weight_unit, recorded_date, recorded_by, notes)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [req.params.id, weight, weight_unit || 'kg', recorded_date, req.user.id, notes]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/animals/:id (soft delete)
router.delete('/:id', authenticate, auditLog('DELETE_ANIMAL', 'livestock'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE animals SET deleted_at=NOW(), status=$1 WHERE id=$2',
      ['dead', req.params.id]
    );
    res.json({ message: 'Animal removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// POST /api/animals/:id/treatment
router.post('/:id/treatment', authenticate, auditLog('RECORD_TREATMENT', 'livestock'), async (req, res) => {
  try {
    const {
      diagnosis, treatment, medicine_used, dosage,
      vet_name, treatment_date, follow_up_date, cost, notes
    } = req.body;
    const result = await pool.query(`
      INSERT INTO health_treatments
        (animal_id, diagnosis, treatment, medicine_used, dosage,
         vet_name, treatment_date, follow_up_date, cost, notes, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [req.params.id, diagnosis, treatment, medicine_used, dosage,
        vet_name, treatment_date || new Date(), follow_up_date,
        cost || 0, notes, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/animals/:id/death
router.post('/:id/death', authenticate, auditLog('RECORD_DEATH', 'livestock'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { death_date, cause, description, disposal_method } = req.body;

    // Record death
    const result = await client.query(`
      INSERT INTO animal_deaths (animal_id, death_date, cause, description, disposal_method, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [req.params.id, death_date || new Date(), cause, description, disposal_method, req.user.id]);

    // Update animal status
    await client.query(
      `UPDATE animals SET status='dead', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );

    // Notify admin of mortality
    try {
      const { broadcastToRoles } = require('../services/notifications');
      const animal = await client.query('SELECT animal_id FROM animals WHERE id=$1', [req.params.id]);
      await broadcastToRoles(
        ['super_admin', 'farm_manager'],
        `💀 Mortality Recorded: ${animal.rows[0]?.animal_id}`,
        `Cause: ${cause}. Recorded by ${req.user.full_name}.`,
        'mortality', 'animal', req.params.id
      );
    } catch (e) { /* notification failure should not block death record */ }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});
