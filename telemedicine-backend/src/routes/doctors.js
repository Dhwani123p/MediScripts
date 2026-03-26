const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// PATCH /api/doctors/profile — doctor updates their own professional profile
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const {
      specialty, qualification, experience, hospital,
      location, consultation_fee, bio, languages, full_name,
    } = req.body;

    // Get doctor's full_name from users table as fallback
    const userRes = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.userId]);
    const userName = (userRes.rows[0] || {}).full_name || '';

    const existing = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.userId]);

    let result;
    if (existing.rows.length === 0) {
      // Create the doctors row if it doesn't exist yet
      result = await pool.query(
        `INSERT INTO doctors
           (user_id, full_name, specialty, qualification, experience, hospital, location,
            consultation_fee, bio, languages, available, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
         RETURNING *`,
        [
          req.userId,
          full_name || userName,
          specialty || 'General Physician',
          qualification || null,
          experience ? parseInt(experience) : 0,
          hospital || null,
          location || null,
          consultation_fee ? parseFloat(consultation_fee) : 0,
          bio || null,
          languages || null,
        ]
      );
    } else {
      result = await pool.query(
        `UPDATE doctors SET
           full_name        = COALESCE($1, full_name),
           specialty        = COALESCE($2, specialty),
           qualification    = COALESCE($3, qualification),
           experience       = COALESCE($4, experience),
           hospital         = COALESCE($5, hospital),
           location         = COALESCE($6, location),
           consultation_fee = COALESCE($7, consultation_fee),
           bio              = COALESCE($8, bio),
           languages        = COALESCE($9, languages)
         WHERE user_id = $10
         RETURNING *`,
        [
          full_name || null,
          specialty || null,
          qualification || null,
          experience ? parseInt(experience) : null,
          hospital || null,
          location || null,
          consultation_fee ? parseFloat(consultation_fee) : null,
          bio || null,
          languages || null,
          req.userId,
        ]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ PATCH /doctors/profile error:', error.message);
    res.status(500).json({ error: 'Failed to update doctor profile' });
  }
});

// GET all doctors
router.get('/', async (req, res) => {
  try {
    const { search, specialty, available, sort = 'rating' } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(full_name ILIKE $${params.length} OR specialty ILIKE $${params.length})`);
    }
    if (specialty && specialty !== 'all') {
      params.push(specialty);
      conditions.push(`specialty = $${params.length}`);
    }
    if (available === 'true') {
      conditions.push(`available = true`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderMap = {
      rating: 'rating DESC',
      experience: 'experience DESC',
      fee_asc: 'consultation_fee ASC',
      fee_desc: 'consultation_fee DESC',
    };
    const orderBy = orderMap[sort] || 'rating DESC';

    const result = await pool.query(
      `SELECT * FROM doctors ${where} ORDER BY ${orderBy} LIMIT 100`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ GET /doctors error:', error.message);
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET all specialties
router.get('/specialties', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT specialty FROM doctors ORDER BY specialty'
    );
    res.json(result.rows.map(r => r.specialty));
  } catch (error) {
    console.error('❌ GET /doctors/specialties error:', error.message);
    res.status(500).json({ error: 'Failed to fetch specialties' });
  }
});

// GET single doctor — MUST be after /specialties
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM doctors WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ GET /doctors/:id error:', error.message);
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

module.exports = router;