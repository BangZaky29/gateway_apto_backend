// =========================================
// FILE: controllers/authController.js
// FINAL - Auto Trial Package on Register
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

  // 1️⃣ Insert user
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

      // 2️⃣ Insert OTP
      db.query(
        `INSERT INTO otp_verifications 
         (user_id, otp_code, expired_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
        [userId, otp],
        (err) => {
          if (err) console.error('OTP insert error:', err);
        }
      );

      // 3️⃣ Ambil paket trial dari database
      db.query(
        `SELECT id, duration_days 
         FROM packages 
         WHERE is_trial = 1 AND is_active = 1 
         LIMIT 1`,
        (err, rows) => {
          if (err || !rows.length) {
            console.error('❌ Trial package tidak ditemukan');
            return;
          }

          const trialPackage = rows[0];
          const trialToken = uuid();

          // 4️⃣ Insert token trial
          db.query(
            `INSERT INTO user_tokens
             (user_id, package_id, token, activated_at, expired_at, is_active, is_trial)
             VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 1, 1)`,
            [
              userId,
              trialPackage.id,
              trialToken,
              trialPackage.duration_days,
            ],
            (err) => {
              if (err) {
                console.error('❌ Trial activation error:', err);
              } else {
                console.log(`✅ Trial package activated for user ${userId}`);
              }
            }
          );
        }
      );

      // ⚠️ sementara log OTP
      console.log('OTP:', otp);

      // 5️⃣ Response
      res.json({
        message: 'Register success, OTP sent. Trial package activated!',
        trial: {
          duration: 'Trial aktif',
        },
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
    `SELECT o.*
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

      const otpRow = rows[0];

      db.query(
        'UPDATE otp_verifications SET is_used = 1 WHERE id = ?',
        [otpRow.id]
      );

      db.query(
        'UPDATE users SET is_verified = 1 WHERE id = ?',
        [otpRow.user_id]
      );

      res.json({ message: 'OTP verified successfully' });
    }
  );
};

/**
 * LOGIN
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

      const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.json({ token });
    }
  );
};

/**
 * ME
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
      [decoded.id],
      (err, rows) => {
        if (err || !rows.length) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.json(rows[0]);
      }
    );
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
