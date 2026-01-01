// ==========================================
// routes/user.js - User Management
// ==========================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const adminAuth = require('../middlewares/adminMiddleware');

// GET all users with their package info (admin only)
router.get('/', adminAuth, (req, res) => {
  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.phone,
      u.is_verified,
      u.created_at,
      ut.token,
      ut.activated_at,
      ut.expired_at,
      p.id as package_id,
      p.name as package_name,
      p.price as package_price
    FROM users u
    LEFT JOIN (
      SELECT user_id, token, package_id, activated_at, expired_at
      FROM user_tokens
      WHERE expired_at > NOW()
      ORDER BY activated_at DESC) ut ON ut.user_id = u.id
    LEFT JOIN packages p ON p.id = ut.package_id
    ORDER BY u.created_at DESC
  `;

  db.query(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET user by ID (admin only)
router.get('/:id', adminAuth, (req, res) => {
  const query = `
    SELECT 
      u.*,
      ut.token,
      ut.expired_at,
      p.name as package_name
    FROM users u
    LEFT JOIN user_tokens ut ON ut.user_id = u.id AND ut.expired_at > NOW()
    LEFT JOIN packages p ON p.id = ut.package_id
    WHERE u.id = ?
  `;

  db.query(query, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  });
});

// GET user statistics (admin only)
router.get('/stats/summary', adminAuth, (req, res) => {
  const stats = {};

  db.query('SELECT COUNT(*) as total FROM users', (err, rows) => {
    stats.total = rows[0].total;

    db.query('SELECT COUNT(*) as verified FROM users WHERE is_verified=1', (err, rows) => {
      stats.verified = rows[0].verified;

      db.query('SELECT COUNT(*) as active FROM user_tokens WHERE expired_at > NOW()', (err, rows) => {
        stats.activeSubscriptions = rows[0].active;
        res.json(stats);
      });
    });
  });
});

module.exports = router;
