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
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, d.full_name AS doctor_name
       FROM prescriptions p
       LEFT JOIN doctors d ON d.id = p.doctor_id
       WHERE p.patient_id = $1
       ORDER BY p.prescribed_date DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GET /prescriptions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// ── POST /api/prescriptions ───────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  try {
    const { patient_id, medication, dosage, instructions } = req.body;
    if (!patient_id || !medication) {
      return res.status(400).json({ error: 'patient_id and medication are required' });
    }
    const docResult = await pool.query(
      'SELECT id FROM doctors WHERE user_id = $1', [req.userId]
    );
    const doctor_id = docResult.rows[0]?.id || null;
    const result = await pool.query(
      `INSERT INTO prescriptions
        (patient_id, doctor_id, medication, dosage, instructions, status, prescribed_date, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
       RETURNING *`,
      [patient_id, doctor_id, medication, dosage || '', instructions || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('POST /prescriptions error:', error.message);
    res.status(500).json({ error: 'Failed to create prescription' });
  }
});

// ── POST /api/prescriptions/extract ──────────────────────────────────────────
// Calls the ML model API to extract structured medicine entities from text.
// Returns medicines ready to populate an editable prescription form.
// Does NOT save anything to the database.
//
// Request  : { "text": "Paracetamol 650 mg twice daily for 5 days after food" }
// Response : {
//   "medicines": [{ drug, dose, frequency, duration, route }, …],
//   "raw":       { drugs:[…], doses:[…], frequencies:[…], durations:[…], routes:[…] }
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
//   "transcript": "Paracetamol 650 mg …",
//   "medicines":  [{ drug, dose, frequency, duration, route }, …],
//   "raw":        { drugs:[…], … }
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
