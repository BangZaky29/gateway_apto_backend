// ==========================================
// routes/user.js - User Management - FINAL
// ==========================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const adminAuth = require('../middlewares/adminMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');

// ================================
// GET CURRENT USER PROFILE
// ================================
router.get('/me', authMiddleware, (req, res) => {
  const query = `
    SELECT 
      id,
      name,
      email,
      phone,
      is_verified,
      created_at
    FROM users
    WHERE id = ?
  `;

  db.query(query, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(rows[0]);
  });
});

// ================================
// GET CURRENT USER TOKENS
// ================================
router.get('/tokens', authMiddleware, (req, res) => {
  const query = `
    SELECT 
      ut.*,
      p.name as package_name,
      p.price,
      p.duration_days
    FROM user_tokens ut
    JOIN packages p ON p.id = ut.package_id
    WHERE ut.user_id = ?
    ORDER BY ut.activated_at DESC
  `;

  db.query(query, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

// ================================
// GET ALL USERS (ADMIN)
// ================================
router.get('/', adminAuth, (req, res) => {
  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.is_verified,
      u.created_at
    FROM users u
    ORDER BY u.created_at DESC
  `;

  db.query(query, (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
});

module.exports = router;
