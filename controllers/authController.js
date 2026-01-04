// =========================================
// FILE: controllers/authController.js - UPDATED
// Added: Auto Trial Package on Register
// =========================================

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtp } = require('../utils/otp');
const { v4: uuid } = require('uuid');

exports.register = (req, res) => {
  const { name, email, phone, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.query(
    'INSERT INTO users (name,email,phone,password) VALUES (?,?,?,?)',
    [name, email, phone, hash],
    (err, result) => {
      if (err) return res.status(400).json(err);

      const userId = result.insertId;
      const otp = generateOtp();
      
      // Insert OTP
      db.query(
        'INSERT INTO otp_verifications (user_id,otp_code,expired_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
        [userId, otp],
        (err) => {
          if (err) console.error('OTP insert error:', err);
        }
      );

      // ✅ AUTO-ACTIVATE TRIAL PACKAGE 3 HARI
      // Asumsi: package_id 1 adalah paket trial atau buat logic khusus
      const trialToken = uuid();
      const trialPackageId = 1; // Sesuaikan dengan ID package trial di DB Anda
      
      db.query(
        `INSERT INTO user_tokens (user_id, package_id, token, activated_at, expired_at, is_active)
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY), 1)`,
        [userId, trialPackageId, trialToken],
        (err) => {
          if (err) {
            console.error('Trial package activation error:', err);
          } else {
            console.log(`✅ Trial package activated for user ${userId}`);
          }
        }
      );

      // ⚠️ nanti diganti send WA API
      console.log('OTP:', otp);

      res.json({ 
        message: 'Register success, OTP sent. Trial package activated!',
        trial: {
          duration: '3 days',
          package: 'Trial Package'
        }
      });
    }
  );
};

exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  db.query(
    `SELECT o.* FROM otp_verifications o
     JOIN users u ON u.id=o.user_id
     WHERE u.email=? AND o.otp_code=? AND o.is_used=0 AND o.expired_at > NOW()`,
    [email, otp],
    (err, rows) => {
      if (rows.length === 0)
        return res.status(400).json({ message: 'OTP invalid' });

      db.query('UPDATE otp_verifications SET is_used=1 WHERE id=?', [rows[0].id]);
      db.query('UPDATE users SET is_verified=1 WHERE id=?', [rows[0].user_id]);

      res.json({ message: 'OTP verified' });
    }
  );
};

exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email=?', [email], (err, rows) => {
    if (!rows.length) return res.status(404).json({ message: 'User not found' });

    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ message: 'Wrong password' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });

    res.json({ token });
  });
};

exports.me = (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Token missing' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    db.query('SELECT id, name, email, phone, is_verified FROM users WHERE id=?', [userId], (err, rows) => {
      if (err || !rows.length) return res.status(404).json({ message: 'User not found' });
      res.json(rows[0]);
    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};