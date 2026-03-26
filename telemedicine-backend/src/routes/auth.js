const express = require('express');
const { signup, signin } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);

// Get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const pool = require('../config/database');
    const result = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;