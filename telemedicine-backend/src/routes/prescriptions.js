const express  = require('express');
const axios    = require('axios');
const multer   = require('multer');
const FormData = require('form-data');
const pool     = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// Keep audio in memory — no disk writes needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 },   // 25 MB max
});

const router = express.Router();

// ── GET /api/prescriptions ────────────────────────────────────────────────────
// Patient → their own prescriptions (patient_id = user id)
// Doctor  → prescriptions they wrote  (doctor.user_id = user id)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              u.full_name AS patient_name,
              d.full_name AS doctor_name
       FROM   prescriptions p
       LEFT JOIN users    u ON u.id = p.patient_id
       LEFT JOIN doctors  d ON d.id = p.doctor_id
       WHERE  p.patient_id = $1
          OR  d.user_id    = $1
       ORDER BY p.prescribed_date DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GET /prescriptions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// ── GET /api/prescriptions/:id — full prescription detail ─────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              u.full_name     AS patient_name,
              u.email         AS patient_email,
              u.phone         AS patient_phone,
              d.full_name     AS doctor_name,
              d.specialty     AS doctor_specialty,
              d.hospital      AS doctor_hospital,
              d.location      AS doctor_location,
              d.qualification AS doctor_qualification,
              d.experience    AS doctor_experience
       FROM   prescriptions p
       LEFT JOIN users   u ON u.id = p.patient_id
       LEFT JOIN doctors d ON d.id = p.doctor_id
       WHERE  p.id = $1
         AND  (p.patient_id = $2 OR d.user_id = $2)`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Prescription not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('GET /prescriptions/:id error:', error.message);
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

// ── POST /api/prescriptions ───────────────────────────────────────────────────
// Accepts either { patient_id, medication, ... }
//             or { appointment_id, medication, ... }  ← backend resolves patient
router.post('/', verifyToken, async (req, res) => {
  try {
    let { patient_id, appointment_id, medication, dosage, instructions, diagnosis, medications_json, interactions } = req.body;

    // Resolve patient from appointment if patient_id is missing/zero
    if ((!patient_id || patient_id === 0) && appointment_id) {
      const apptRow = await pool.query(
        'SELECT patient_id FROM appointments WHERE id = $1', [appointment_id]
      );
      if (apptRow.rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      patient_id = apptRow.rows[0].patient_id;
    }

    if (!patient_id || !medication) {
      return res.status(400).json({ error: 'patient_id (or appointment_id) and medication are required' });
    }

    // Normalise interactions — default to empty array, validate it is an array
    const interactionsArr = Array.isArray(interactions) ? interactions : [];
    // Flag for the response — doctor may proceed; this is informational only
    const interactionWarning = interactionsArr.some((i) => i.severity === 'high');

    // Get or auto-create doctor record for this user
    let docResult = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [req.userId]);
    if (docResult.rows.length === 0) {
      const userRow = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.userId]);
      const fullName = userRow.rows[0]?.full_name || 'Doctor';
      docResult = await pool.query(
        `INSERT INTO doctors (user_id, full_name, specialty, available, created_at)
         VALUES ($1, $2, 'General Physician', true, NOW()) RETURNING id`,
        [req.userId, fullName]
      );
    }
    const doctor_id = docResult.rows[0]?.id || null;

    const result = await pool.query(
      `INSERT INTO prescriptions
        (patient_id, doctor_id, medication, dosage, instructions, diagnosis, medications_json, interactions, status, prescribed_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
       RETURNING *`,
      [patient_id, doctor_id, medication, dosage || '', instructions || '', diagnosis || null, medications_json || null, JSON.stringify(interactionsArr)]
    );
    res.status(201).json({ ...result.rows[0], interactionWarning });
  } catch (error) {
    console.error('POST /prescriptions error:', error.message);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// ── PATCH /api/prescriptions/:id — patient marks own prescription as done ────
router.patch('/:id', verifyToken, async (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'completed', 'cancelled'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    // Only the patient who owns the prescription (or doctor who wrote it) may update
    const result = await pool.query(
      `UPDATE prescriptions
       SET    status = $1
       WHERE  id = $2
         AND  (
           patient_id = $3
           OR doctor_id IN (SELECT id FROM doctors WHERE user_id = $3)
         )
       RETURNING *`,
      [status, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found or access denied' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('PATCH /prescriptions/:id error:', error.message);
    res.status(500).json({ error: 'Failed to update prescription status' });
  }
});

// ── POST /api/prescriptions/extract ──────────────────────────────────────────
// Calls the ML model API to extract structured medicine entities from text.
// Returns medicines ready to populate an editable prescription form.
// Does NOT save anything to the database.
//
// Request  : { "text": "Paracetamol 650 mg twice daily for 5 days after food" }
// Response : {
//   "medicines":     [{ drug, dose, frequency, duration, route,
//                       confidence: { drug, dose, frequency, duration, route } }, …],
//   "interactions":  [{ drugs: [string, string], severity: "high"|"moderate"|"low",
//                       description: string, source: string }, …],
//   "raw":           { drugs:[…], …, confidence_scores: { drugs:[…], … } }
// }
router.post('/extract', verifyToken, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const ML_API_URL = process.env.ML_API_URL || 'http://localhost:7860';
  try {
    const mlRes = await axios.post(
      `${ML_API_URL}/api/predict`,
      { text: text.trim() },
      { timeout: 30000 }           // 30 s — model inference can be slow on CPU
    );
    res.json(mlRes.data);
  } catch (error) {
    const status  = error.response?.status;
    const details = error.response?.data || error.message;
    console.error('POST /prescriptions/extract error:', details);

    if (status) {
      res.status(502).json({ error: 'ML API returned an error', details });
    } else {
      res.status(503).json({ error: 'ML API is unreachable', details: error.message });
    }
  }
});

// ── POST /api/prescriptions/from-audio ───────────────────────────────────────
// Receives a recorded audio blob from the doctor's browser, forwards it to the
// ML API (Whisper → NER) and returns transcript + structured medicine list.
// The frontend uses this response to auto-fill the editable prescription form.
//
// Request  : multipart/form-data  field name: "audio"
// Response : {
//   "transcript":   "Paracetamol 650 mg …",
//   "medicines":    [{ drug, dose, frequency, duration, route, confidence: {…} }, …],
//   "interactions": [{ drugs, severity, description, source }, …],
//   "raw":          { drugs:[…], … }
// }
router.post('/from-audio', verifyToken, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'audio file is required (field name: audio)' });
  }

  const ML_API_URL = process.env.ML_API_URL || 'http://localhost:7860';
  const form = new FormData();
  form.append('file', req.file.buffer, {
    filename:    req.file.originalname || 'recording.webm',
    contentType: req.file.mimetype     || 'audio/webm',
  });

  try {
    const mlRes = await axios.post(`${ML_API_URL}/api/process-audio`, form, {
      headers: form.getHeaders(),
      timeout: 60_000,          // Whisper on CPU can take ~30 s
    });
    res.json(mlRes.data);
  } catch (error) {
    const status  = error.response?.status;
    const details = error.response?.data || error.message;
    console.error('POST /prescriptions/from-audio error:', details);
    res.status(status ? 502 : 503).json({ error: 'ML API error', details });
  }
});

module.exports = router;
