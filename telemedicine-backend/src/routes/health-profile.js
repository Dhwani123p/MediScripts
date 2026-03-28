const express  = require('express');
const multer   = require('multer');
const pool     = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const router   = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_, file, cb) => {
    const allowed = ['application/pdf','image/jpeg','image/png','image/jpg','image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

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

// ── GET /api/health-profile/patient/:userId — doctor OR the patient themselves ─
router.get('/patient/:userId', verifyToken, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);
    // Allow: doctor viewing any patient, OR patient viewing their own profile
    const isSelf = req.userId === targetId;
    if (!isSelf) {
      const docCheck = await pool.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'doctor'", [req.userId]
      );
      if (docCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
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

// ── GET /api/health-profile/reports — list own reports ────────────────────
router.get('/reports', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, file_name, file_type, report_type, notes, file_size, uploaded_at
       FROM medical_reports WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /reports error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ── GET /api/health-profile/reports/:id/download — download report ─────────
router.get('/reports/:id/download', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM medical_reports WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    const buf = Buffer.from(r.file_data, 'base64');
    res.setHeader('Content-Type', r.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${r.file_name}"`);
    res.send(buf);
  } catch (err) {
    console.error('GET /reports/:id/download error:', err.message);
    res.status(500).json({ error: 'Failed to download report' });
  }
});

// ── GET /api/health-profile/patient/:userId/reports — doctor views reports ─
router.get('/patient/:userId/reports', verifyToken, async (req, res) => {
  try {
    const docCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'doctor'", [req.userId]
    );
    if (!docCheck.rows.length) return res.status(403).json({ error: 'Only doctors can view patient reports' });
    const result = await pool.query(
      `SELECT id, file_name, file_type, report_type, notes, file_size, uploaded_at
       FROM medical_reports WHERE user_id = $1 ORDER BY uploaded_at DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /patient/:userId/reports error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ── GET /api/health-profile/reports/:id/doctor-view — doctor downloads ─────
router.get('/reports/:id/doctor-view', verifyToken, async (req, res) => {
  try {
    const docCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'doctor'", [req.userId]
    );
    if (!docCheck.rows.length) return res.status(403).json({ error: 'Only doctors can view reports' });
    const result = await pool.query(
      'SELECT * FROM medical_reports WHERE id = $1', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    const buf = Buffer.from(r.file_data, 'base64');
    res.setHeader('Content-Type', r.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${r.file_name}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: 'Failed to view report' });
  }
});

// ── POST /api/health-profile/reports — upload a report ────────────────────
router.post('/reports', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded or file type not allowed (PDF/image only)' });
    const { report_type = 'General', notes = '' } = req.body;
    const base64 = req.file.buffer.toString('base64');
    const result = await pool.query(
      `INSERT INTO medical_reports (user_id, file_name, file_data, file_type, report_type, notes, file_size, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, file_name, file_type, report_type, notes, file_size, uploaded_at`,
      [req.userId, req.file.originalname, base64, req.file.mimetype,
       report_type, notes, req.file.size]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /reports error:', err.message);
    res.status(500).json({ error: 'Failed to upload report' });
  }
});

// ── DELETE /api/health-profile/reports/:id ────────────────────────────────
router.delete('/reports/:id', verifyToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM medical_reports WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;
