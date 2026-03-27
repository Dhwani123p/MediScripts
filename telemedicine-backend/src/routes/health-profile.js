const express = require('express');
const pool    = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router  = express.Router();

// ── GET /api/health-profile — own profile ─────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM health_profiles WHERE user_id = $1', [req.userId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('GET /health-profile error:', err.message);
    res.status(500).json({ error: 'Failed to fetch health profile' });
  }
});

// ── PUT /api/health-profile — upsert own profile ──────────────────────────
router.put('/', verifyToken, async (req, res) => {
  const {
    date_of_birth, gender, blood_group,
    height_cm, weight_kg,
    allergies, current_medications, chronic_conditions,
    past_surgeries, family_history,
    emergency_contact_name, emergency_contact_phone,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO health_profiles
         (user_id, date_of_birth, gender, blood_group, height_cm, weight_kg,
          allergies, current_medications, chronic_conditions, past_surgeries,
          family_history, emergency_contact_name, emergency_contact_phone, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         date_of_birth           = EXCLUDED.date_of_birth,
         gender                  = EXCLUDED.gender,
         blood_group             = EXCLUDED.blood_group,
         height_cm               = EXCLUDED.height_cm,
         weight_kg               = EXCLUDED.weight_kg,
         allergies               = EXCLUDED.allergies,
         current_medications     = EXCLUDED.current_medications,
         chronic_conditions      = EXCLUDED.chronic_conditions,
         past_surgeries          = EXCLUDED.past_surgeries,
         family_history          = EXCLUDED.family_history,
         emergency_contact_name  = EXCLUDED.emergency_contact_name,
         emergency_contact_phone = EXCLUDED.emergency_contact_phone,
         updated_at              = NOW()
       RETURNING *`,
      [req.userId, date_of_birth||null, gender||null, blood_group||null,
       height_cm||null, weight_kg||null,
       allergies||null, current_medications||null, chronic_conditions||null,
       past_surgeries||null, family_history||null,
       emergency_contact_name||null, emergency_contact_phone||null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /health-profile error:', err.message);
    res.status(500).json({ error: 'Failed to save health profile' });
  }
});

// ── GET /api/health-profile/patient/:userId — doctor views patient profile ─
router.get('/patient/:userId', verifyToken, async (req, res) => {
  try {
    // Verify requester is a doctor
    const docCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'doctor'", [req.userId]
    );
    if (docCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only doctors can view patient profiles' });
    }

    const [profileRes, userRes, presRes] = await Promise.all([
      pool.query('SELECT * FROM health_profiles WHERE user_id = $1', [req.params.userId]),
      pool.query('SELECT full_name, email, phone FROM users WHERE id = $1', [req.params.userId]),
      pool.query(
        `SELECT p.medication, p.dosage, p.instructions, p.prescribed_date,
                d.full_name AS doctor_name
         FROM prescriptions p
         LEFT JOIN doctors d ON d.id = p.doctor_id
         WHERE p.patient_id = $1
         ORDER BY p.prescribed_date DESC LIMIT 20`,
        [req.params.userId]
      ),
    ]);

    const profile = profileRes.rows[0] || {};
    const user    = userRes.rows[0]    || {};

    // Calculate age from date_of_birth
    let age = null;
    if (profile.date_of_birth) {
      const dob  = new Date(profile.date_of_birth);
      const diff = Date.now() - dob.getTime();
      age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }

    res.json({
      ...profile,
      age,
      full_name:    user.full_name,
      email:        user.email,
      phone:        user.phone,
      prescriptions: presRes.rows,
    });
  } catch (err) {
    console.error('GET /health-profile/patient/:userId error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patient profile' });
  }
});

module.exports = router;
