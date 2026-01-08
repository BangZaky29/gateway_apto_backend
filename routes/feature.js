// ==========================================
// routes/feature.js - WITH USER PACKAGE ACCESS
// ==========================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { logInfo, logError } = require('../middlewares/logger');

// ===== GET ALL FEATURES =====
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    
    // Jika user login, ambil userId dari auth middleware
    const userId = req.user?.id;

    let rows;
    if (userId) {
      // Ambil fitur user dari paket aktif
      [rows] = await conn.query(
        `SELECT f.id, f.name, f.code, f.status
         FROM features f
         LEFT JOIN package_feature pf ON pf.feature_id = f.id
         LEFT JOIN user_package up ON up.package_id = pf.package_id AND up.user_id = ? AND up.is_active = 1
         GROUP BY f.id
         ORDER BY f.id ASC`, 
        [userId]
      );
    } else {
      // Semua fitur untuk non-login
      [rows] = await conn.query(
        'SELECT id, name, code, status FROM features ORDER BY id ASC'
      );
    }

    res.json({
      success: true,
      data: rows,
      message: 'Features retrieved successfully'
    });

  } catch (error) {
    logError(error, 'GET /feature');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch features',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ===== GET FEATURE BY ID =====
router.get('/:id', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid feature ID' });
    }

    conn = await db.getConnection();
    const [rows] = await conn.query(
      'SELECT id, name, code, status FROM features WHERE id = ?',
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Feature retrieved successfully' });

  } catch (error) {
    logError(error, `GET /feature/${req.params.id}`);
    res.status(500).json({ success: false, message: 'Failed to fetch feature', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

// ===== SEARCH FEATURES BY CODE =====
router.get('/search/:code', async (req, res) => {
  let conn;
  try {
    const { code } = req.params;
    if (!code || code.trim() === '') {
      return res.status(400).json({ success: false, message: 'Feature code is required' });
    }

    conn = await db.getConnection();
    const [rows] = await conn.query(
      'SELECT id, name, code, status FROM features WHERE code = ? OR name LIKE ? ORDER BY id ASC',
      [code, `%${code}%`]
    );

    res.json({ success: true, data: rows, message: `Found ${rows.length} feature(s)` });

  } catch (error) {
    logError(error, `GET /feature/search/${req.params.code}`);
    res.status(500).json({ success: false, message: 'Failed to search features', error: error.message });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
