const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/appointments — patient sees own, doctor sees their patients'
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*,
        u.full_name  AS patient_name,
        d.full_name  AS doctor_name,
        d.specialty  AS doctor_specialty,
        d.consultation_fee
       FROM appointments a
       JOIN users   u ON u.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.patient_id = $1 OR d.user_id = $1
       ORDER BY a.appointment_date DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ GET /appointments error:', error.message);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// POST /api/appointments — patient books with a doctor
router.post('/', verifyToken, async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_type = 'video', notes } = req.body;
    if (!doctor_id || !appointment_date) {
      return res.status(400).json({ error: 'doctor_id and appointment_date are required' });
    }
    const result = await pool.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, appointment_date, appointment_type, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'scheduled', $5, NOW(), NOW())
       RETURNING *`,
      [req.userId, doctor_id, appointment_date, appointment_type, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ POST /appointments error:', error.message);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// POST /api/appointments/for-patient — doctor schedules appointment for a patient
// Body: { patient_email, appointment_date, appointment_type, notes }
router.post('/for-patient', verifyToken, async (req, res) => {
  try {
    const { patient_email, appointment_date, appointment_type = 'video', notes } = req.body;
    if (!patient_email || !appointment_date) {
      return res.status(400).json({ error: 'patient_email and appointment_date are required' });
    }

    // Look up patient by email
    const patientRes = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND role = 'patient'`,
      [patient_email.toLowerCase().trim()]
    );
    if (patientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found with that email' });
    }
    const patient_id = patientRes.rows[0].id;

    // Look up doctor record for the logged-in doctor user
    const doctorRes = await pool.query(
      `SELECT id FROM doctors WHERE user_id = $1`,
      [req.userId]
    );
    if (doctorRes.rows.length === 0) {
      return res.status(403).json({ error: 'Only doctors can schedule appointments for patients' });
    }
    const doctor_id = doctorRes.rows[0].id;

    const result = await pool.query(
      `INSERT INTO appointments
        (patient_id, doctor_id, appointment_date, appointment_type, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'scheduled', $5, NOW(), NOW())
       RETURNING *`,
      [patient_id, doctor_id, appointment_date, appointment_type, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ POST /appointments/for-patient error:', error.message);
    res.status(500).json({ error: 'Failed to schedule appointment' });
  }
});

// PATCH /api/appointments/:id — update status/notes (patient OR doctor)
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { status, notes, prescription } = req.body;
    // Allow update if the current user is the patient OR the doctor for this appointment
    const result = await pool.query(
      `UPDATE appointments a
       SET status       = COALESCE($1, a.status),
           notes        = COALESCE($2, a.notes),
           prescription = COALESCE($3, a.prescription),
           updated_at   = NOW()
       FROM appointments a2
       JOIN doctors d ON d.id = a2.doctor_id
       WHERE a.id = a2.id
         AND a.id = $4
         AND (a2.patient_id = $5 OR d.user_id = $5)
       RETURNING a.*`,
      [status || null, notes || null, prescription || null, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      // Fallback: try simpler update without self-join (some PG versions differ)
      const r2 = await pool.query(
        `UPDATE appointments SET
           status       = COALESCE($1, status),
           notes        = COALESCE($2, notes),
           prescription = COALESCE($3, prescription),
           updated_at   = NOW()
         WHERE id = $4
           AND (patient_id = $5
                OR doctor_id IN (SELECT id FROM doctors WHERE user_id = $5))
         RETURNING *`,
        [status || null, notes || null, prescription || null, req.params.id, req.userId]
      );
      if (r2.rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found or access denied' });
      }
      return res.json(r2.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ PATCH /appointments error:', error.message);
    // Last resort: simple update with doctor subquery
    try {
      const r3 = await pool.query(
        `UPDATE appointments SET
           status       = COALESCE($1, status),
           notes        = COALESCE($2, notes),
           prescription = COALESCE($3, prescription),
           updated_at   = NOW()
         WHERE id = $4
           AND (patient_id = $5
                OR doctor_id IN (SELECT id FROM doctors WHERE user_id = $5))
         RETURNING *`,
        [req.body.status || null, req.body.notes || null, req.body.prescription || null, req.params.id, req.userId]
      );
      if (r3.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
      return res.json(r3.rows[0]);
    } catch {
      res.status(500).json({ error: 'Failed to update appointment' });
    }
  }
});

// DELETE /api/appointments/:id — cancel (patient only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND patient_id = $2 RETURNING *`,
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('❌ DELETE /appointments error:', error.message);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

module.exports = router;
