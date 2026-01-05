// =========================================
// FILE: controllers/authController.js
// FINAL - FIX JWT PAYLOAD + ME
// =========================================

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtp } = require('../utils/otp');
const { v4: uuid } = require('uuid');

/**
 * REGISTER
 */
exports.register = (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: 'Data tidak lengkap' });
  }

  const hash = bcrypt.hashSync(password, 10);

  db.query(
    'INSERT INTO users (name,email,phone,password) VALUES (?,?,?,?)',
    [name, email, phone, hash],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Email sudah terdaftar' });
        }
        return res.status(500).json(err);
      }

      const userId = result.insertId;
      const otp = generateOtp();

      // OTP
      db.query(
        `INSERT INTO otp_verifications 
         (user_id, otp_code, expired_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
        [userId, otp]
      );

      // Trial package
      db.query(
        `SELECT id, duration_days 
         FROM packages 
         WHERE is_trial = 1 AND is_active = 1 
         LIMIT 1`,
        (err, rows) => {
          if (!err && rows.length) {
            const trial = rows[0];
            db.query(
              `INSERT INTO user_tokens
               (user_id, package_id, token, activated_at, expired_at, is_active, is_trial)
               VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 1, 1)`,
              [userId, trial.id, uuid(), trial.duration_days]
            );
          }
        }
      );

      console.log('OTP:', otp);

      res.json({
        message: 'Register success, OTP sent. Trial package activated'
      });
    }
  );
};

/**
 * VERIFY OTP
 */
exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  db.query(
    `SELECT o.id, o.user_id
     FROM otp_verifications o
     JOIN users u ON u.id = o.user_id
     WHERE u.email = ?
       AND o.otp_code = ?
       AND o.is_used = 0
       AND o.expired_at > NOW()`,
    [email, otp],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(400).json({ message: 'OTP tidak valid' });
      }

      const data = rows[0];

      db.query('UPDATE otp_verifications SET is_used = 1 WHERE id = ?', [data.id]);
      db.query('UPDATE users SET is_verified = 1 WHERE id = ?', [data.user_id]);

      res.json({ message: 'OTP verified successfully' });
    }
  );
};

/**
 * LOGIN (🔥 FIX JWT PAYLOAD)
 */
exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    (err, rows) => {
      if (err || !rows.length) {
        return res.status(404).json({ message: 'User tidak ditemukan' });
      }

      const user = rows[0];

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: 'Password salah' });
      }

      // ✅ FIXED PAYLOAD
        const token = jwt.sign(
          {
            id: user.id,           // PENTING
            email: user.email,
            role: 'user'
          },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.json({ token });
    }
  );
};

/**
 * ME (🔥 FIX decoded.user_id)
 */
exports.me = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    db.query(
      'SELECT id, name, email, phone, is_verified FROM users WHERE id = ?',
      [decoded.user_id], // ✅ FIX
      (err, rows) => {
        if (err || !rows.length) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.json(rows[0]);
      }
    );
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
