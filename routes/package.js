// ==========================================
// routes/package.js - FIXED ASYNC/AWAIT VERSION
// ==========================================
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const adminAuth = require('../middlewares/adminMiddleware');
const { logInfo, logError } = require('../middlewares/logger');

// ===== GET ALL PACKAGES (PUBLIC) =====
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(
      'SELECT * FROM packages ORDER BY price ASC'
    );

    // Pastikan selalu array (frontend aman pakai .filter/.map)
    const packages = Array.isArray(rows) ? rows : [];

    res.json({
      success: true,
      data: packages,
      message: 'Packages retrieved successfully'
    });
    
  } catch (error) {
    logError(error, 'GET /packages');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch packages',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ===== GET PACKAGE BY ID =====
router.get('/:id', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    conn = await db.getConnection();
    const [rows] = await conn.query(
      'SELECT * FROM packages WHERE id = ?',
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    res.json({
      success: true,
      data: rows[0],
      message: 'Package retrieved successfully'
    });

  } catch (error) {
    logError(error, `GET /packages/${req.params.id}`);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch package',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ===== CREATE PACKAGE (ADMIN ONLY) =====
router.post('/', adminAuth, async (req, res) => {
  let conn;
  try {
    const { name, price, duration_days, description = null, is_active = 1, is_trial = 0 } = req.body;

    if (!name || !price || !duration_days) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, price, duration_days'
      });
    }

    conn = await db.getConnection();
    const [result] = await conn.query(
      `INSERT INTO packages (name, price, duration_days, description, is_active, is_trial) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, price, duration_days, description, is_active, is_trial]
    );

    logInfo(`Package created: ID ${result.insertId}`);
    res.status(201).json({
      success: true,
      data: { id: result.insertId, name, price, duration_days, description, is_active, is_trial },
      message: 'Package created successfully'
    });

  } catch (error) {
    logError(error, 'POST /packages');
    res.status(500).json({
      success: false,
      message: 'Failed to create package',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ===== UPDATE PACKAGE (ADMIN ONLY) =====
router.put('/:id', adminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { name, price, duration_days, description = null, is_active = 1, is_trial = 0 } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    conn = await db.getConnection();

    const [existing] = await conn.query('SELECT id FROM packages WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const [result] = await conn.query(
      `UPDATE packages 
       SET name = ?, price = ?, duration_days = ?, description = ?, is_active = ?, is_trial = ? 
       WHERE id = ?`,
      [name, price, duration_days, description, is_active, is_trial, id]
    );

    logInfo(`Package updated: ID ${id}`);
    res.json({
      success: true,
      data: { id, name, price, duration_days, description, is_active, is_trial },
      message: 'Package updated successfully'
    });

  } catch (error) {
    logError(error, `PUT /packages/${req.params.id}`);
    res.status(500).json({
      success: false,
      message: 'Failed to update package',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

// ===== DELETE PACKAGE (ADMIN ONLY) =====
router.delete('/:id', adminAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid package ID'
      });
    }

    conn = await db.getConnection();
    const [result] = await conn.query('DELETE FROM packages WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    logInfo(`Package deleted: ID ${id}`);
    res.json({
      success: true,
      message: 'Package deleted successfully'
    });

  } catch (error) {
    logError(error, `DELETE /packages/${req.params.id}`);
    res.status(500).json({
      success: false,
      message: 'Failed to delete package',
      error: error.message
    });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
