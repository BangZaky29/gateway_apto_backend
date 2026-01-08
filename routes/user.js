// ==========================================
// routes/user.js - ASYNC/AWAIT VERSION LENGKAP
// ==========================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middlewares/authMiddleware');
const adminAuth = require('../middlewares/adminMiddleware');
const { logInfo, logError } = require('../middlewares/logger');
const featureAccessController = require('../controllers/featureAccessController');

// ================================
// GET CURRENT USER PROFILE
// ================================
router.get('/me', authMiddleware, async (req, res) => {
  let conn;
  try {
    // Pastikan user ID ada di token
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    conn = await db.getConnection();
    
    const [rows] = await conn.query(
      `SELECT 
        id,
        name,
        email,
        phone,
        is_verified,
        created_at
      FROM users
      WHERE id = ?`,
      [req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    logInfo(`User profile fetched: ID ${req.user.id}`);

    res.json({
      success: true,
      data: rows[0],
      message: 'User profile retrieved successfully'
    });
    
  } catch (error) {
    logError(error, 'GET /users/me');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ================================
// GET CURRENT USER TOKENS
// ================================
router.get('/tokens', authMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    
    const [rows] = await conn.query(
      `SELECT 
        ut.id,
        ut.user_id,
        ut.package_id,
        ut.token,
        ut.activated_at,
        ut.expired_at,
        ut.is_active,
        ut.is_trial,
        p.name AS package_name,
        p.price,
        p.duration_days
      FROM user_tokens ut
      JOIN packages p ON p.id = ut.package_id
      WHERE ut.user_id = ?
      ORDER BY ut.activated_at DESC`,
      [req.user.id]
    );

    logInfo(`User tokens fetched: ID ${req.user.id}, count: ${rows.length}`);

    res.json({
      success: true,
      data: rows,
      message: `Retrieved ${rows.length} token(s)`
    });
    
  } catch (error) {
    logError(error, 'GET /users/tokens');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user tokens',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ======================================================
// FEATURE ACCESS ROUTES
// ======================================================

router.get(
  '/feature-access-status',
  authMiddleware,
  featureAccessController.getFeatureAccessStatus
);

router.get(
  '/feature-access-details',
  authMiddleware,
  featureAccessController.getFeatureAccessDetails
);

router.post(
  '/check-feature-access',
  authMiddleware,
  featureAccessController.checkFeatureAccess
);

// ================================
// GET ALL USERS (ADMIN)
// ================================
router.get('/', adminAuth, async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    
    const [rows] = await conn.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.is_verified,
        u.created_at,
        ut.package_id,
        p.name AS package_name,
        ut.expired_at,
        ut.is_active
      FROM users u
      LEFT JOIN user_tokens ut 
        ON ut.user_id = u.id
        AND ut.is_active = 1
        AND ut.expired_at > NOW()
      LEFT JOIN packages p 
        ON p.id = ut.package_id
      ORDER BY u.created_at DESC`
    );

    logInfo(`All users fetched: count ${rows.length}`);

    res.json({
      success: true,
      data: rows,
      message: `Retrieved ${rows.length} user(s)`
    });
    
  } catch (error) {
    logError(error, 'GET /users (ADMIN)');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ================================
// GET USER BY ID (ADMIN)
// ================================
router.get('/:id', adminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    conn = await db.getConnection();
    
    const [rows] = await conn.query(
      `SELECT 
        id,
        name,
        email,
        phone,
        is_verified,
        created_at
      FROM users
      WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: rows[0],
      message: 'User retrieved successfully'
    });
    
  } catch (error) {
    logError(error, `GET /users/${req.params.id}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;