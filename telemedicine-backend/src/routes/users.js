const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/profile — get current user's profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('GET /users/profile error:', error.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/users/profile — update current user's profile (phone, full_name, etc.)
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    // Only update provided fields
    const updates = [];
    const params = [];
    if (full_name) { params.push(full_name); updates.push(`full_name = $${params.length}`); }
    if (phone)     { params.push(phone);     updates.push(`phone = $${params.length}`); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.userId);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id, email, full_name, role`,
      params
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('PATCH /users/profile error:', error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/users/search?email=xxx — find a patient by email (doctors use this to schedule)
router.get('/search', verifyToken, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query param is required' });
    const result = await pool.query(
      `SELECT id, email, full_name, role FROM users WHERE email ILIKE $1 AND role = 'patient'`,
      [email.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('GET /users/search error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/users/:id — get a user by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('GET /users/:id error:', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
