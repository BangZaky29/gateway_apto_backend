// =========================================
// FILE: controllers/authController.js - FINAL PRODUCTION READY
// Complete Auth with WhatsApp + Forgot Password
// =========================================

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtp } = require('../utils/otp');
const { v4: uuid } = require('uuid');
const whatsappClient = require('../utils/whatsappClient');
const { logInfo, logError } = require('../middlewares/logger');
const normalizePhone = require('../utils/normalizePhone');

// =========================================
// 1️⃣ REGISTER
// =========================================
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Format nomor WhatsApp tidak valid' });
    }

    const [exists] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (exists.length) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp ini sudah terdaftar' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)',
      [name, email, phone, hash]
    );

    const userId = result.insertId;
    const otp = generateOtp();

    await db.query(
      `INSERT INTO otp_verifications (user_id, otp_code, expired_at, type)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 'verify')`,
      [userId, otp]
    );

    // Trial package (optional)
    const [trial] = await db.query(
      'SELECT id, duration_days FROM packages WHERE is_trial = 1 AND is_active = 1 LIMIT 1'
    );
    if (trial.length) {
      await db.query(
        `INSERT INTO user_tokens
         (user_id, package_id, token, activated_at, expired_at, is_active, is_trial)
         VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 1, 1)`,
        [userId, trial[0].id, uuid(), trial[0].duration_days]
      );
    }

    // WA OTP send (async, log errors)
    (async () => {
      try {
        if (whatsappClient.isReady) {
          await whatsappClient.sendOTP(phone, otp);
        }
      } catch (err) {
        logError(err, '[WA] sendOTP failed (register)');
      }
    })();

    res.json({
      success: true,
      message: whatsappClient.isReady
        ? 'Registrasi berhasil! OTP dikirim ke WhatsApp'
        : `Registrasi berhasil! OTP: ${otp}`
    });

  } catch (err) {
    logError(err, 'Register Error');
    res.status(500).json({ success: false, message: 'Registrasi gagal' });
  }
};

// =========================================
// 2️⃣ RESEND OTP
// =========================================
exports.resendOtp = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Nomor WhatsApp diperlukan' });

  let conn;
  try {
    conn = await db.getConnection();

    const [users] = await conn.query('SELECT id, name, phone, is_verified FROM users WHERE phone = ?', [phone]);
    if (!users.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const user = users[0];
    if (user.is_verified) return res.status(400).json({ success: false, message: 'User sudah terverifikasi' });

    const [[{ total }]] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM otp_verifications
       WHERE user_id = ? AND type = 'verify' AND created_at > NOW() - INTERVAL 5 MINUTE`,
      [user.id]
    );
    if (total >= 3) return res.status(429).json({ success: false, message: 'Terlalu banyak permintaan OTP' });

    const [lastOtp] = await conn.query(
      `SELECT created_at
       FROM otp_verifications
       WHERE user_id = ? AND type = 'verify'
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    if (lastOtp.length) {
      const diff = (Date.now() - new Date(lastOtp[0].created_at).getTime()) / 1000;
      if (diff < 60) return res.status(429).json({ success: false, message: `Tunggu ${Math.ceil(60 - diff)} detik sebelum kirim OTP lagi` });
    }

    await conn.query(`UPDATE otp_verifications SET is_used = 1 WHERE user_id = ? AND type = 'verify' AND is_used = 0`, [user.id]);

    const otp = generateOtp();
    await conn.query(`INSERT INTO otp_verifications (user_id, otp_code, expired_at, type) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 'verify')`, [user.id, otp]);

    const waPhone = normalizePhone(user.phone);
    try {
      if (whatsappClient.isReady) await whatsappClient.sendOTP(waPhone, otp, user.name);
      logInfo(`[WA] OTP sent to ${waPhone}`);
    } catch (err) {
      logError(err, '[WA] sendOTP failed (resend)');
    }

    res.json({ success: true, message: 'OTP berhasil dikirim ke WhatsApp' });

  } catch (err) {
    logError(err, 'Resend OTP Error');
    res.status(500).json({ success: false, message: 'Gagal mengirim ulang OTP' });
  } finally {
    if (conn) conn.release();
  }
};

// =========================================
// 3️⃣ VERIFY OTP
// =========================================
exports.verifyOtp = async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ success: false, message: 'Nomor WhatsApp dan OTP wajib diisi' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT o.id, o.user_id, u.name, u.phone
       FROM otp_verifications o
       JOIN users u ON u.id = o.user_id
       WHERE u.phone = ? AND o.otp_code = ? AND o.is_used = 0 AND o.expired_at > NOW() AND o.type = 'verify'
       FOR UPDATE`,
      [phone, otp]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah digunakan' });
    }

    const data = rows[0];
    await conn.query(`UPDATE otp_verifications SET is_used = 1 WHERE id = ?`, [data.id]);
    await conn.query(`UPDATE users SET is_verified = 1 WHERE id = ?`, [data.user_id]);
    await conn.commit();

    const waPhone = normalizePhone(data.phone);
    try {
      if (whatsappClient.isReady) await whatsappClient.sendWelcomeMessage(waPhone, data.name);
    } catch (err) {
      logError(err, '[WA] sendWelcomeMessage failed');
    }

    res.json({ success: true, message: 'OTP berhasil diverifikasi' });

  } catch (err) {
    if (conn) await conn.rollback();
    logError(err, 'Verify OTP Error');
    res.status(500).json({ success: false, message: 'Verifikasi OTP gagal' });
  } finally {
    if (conn) conn.release();
  }
};

// =========================================
// 4️⃣ LOGIN
// =========================================
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const ip = req.ip;

    const [rows] = await db.query('SELECT id, name, email, phone, password, is_verified FROM users WHERE phone = ?', [phone]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

    const user = rows[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ success: false, message: 'Password salah' });
    if (!user.is_verified) return res.status(403).json({ success: false, message: 'Akun belum diverifikasi' });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    (async () => {
      try {
        if (whatsappClient.isReady) await whatsappClient.sendLoginNotification(user.phone, user.name, ip);
      } catch (err) {
        logError(err, '[WA] sendLoginNotification failed');
      }
    })();

    res.json({ success: true, token });

  } catch (err) {
    logError(err, 'Login Error');
    res.status(500).json({ success: false, message: 'Login gagal' });
  }
};

// =========================================
// 5️⃣ FORGOT PASSWORD
// =========================================
exports.forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Nomor WhatsApp diperlukan' });

    const [rows] = await db.query('SELECT id, name FROM users WHERE phone = ?', [phone]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Nomor tidak terdaftar' });

    const user = rows[0];
    const otp = generateOtp();

    await db.query(`UPDATE otp_verifications SET is_used = 1 WHERE user_id = ? AND type = 'reset'`, [user.id]);
    await db.query(`INSERT INTO otp_verifications (user_id, otp_code, expired_at, type) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 'reset')`, [user.id, otp]);

    (async () => {
      try {
        if (whatsappClient.isReady) await whatsappClient.sendPasswordResetOTP(phone, user.name, otp);
      } catch (err) {
        logError(err, '[WA] sendPasswordResetOTP failed');
      }
    })();

    res.json({ success: true, message: whatsappClient.isReady ? 'OTP reset dikirim ke WhatsApp' : `OTP reset: ${otp}` });

  } catch (err) {
    logError(err, 'Forgot Password Error');
    res.status(500).json({ success: false, message: 'Gagal request reset password' });
  }
};

// =========================================
// 6️⃣ VERIFY RESET OTP
// =========================================
exports.verifyResetOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Nomor WhatsApp dan OTP wajib diisi' });

    const [rows] = await db.query(
      `SELECT o.user_id
       FROM otp_verifications o
       JOIN users u ON u.id = o.user_id
       WHERE u.phone = ? AND o.otp_code = ? AND o.is_used = 0 AND o.expired_at > NOW() AND o.type = 'reset'`,
      [phone, otp]
    );

    if (!rows.length) return res.status(400).json({ success: false, message: 'OTP tidak valid' });

    res.json({ success: true, message: 'OTP valid', userId: rows[0].user_id });

  } catch (err) {
    logError(err, 'Verify Reset OTP Error');
    res.status(500).json({ success: false, message: 'Verifikasi OTP gagal' });
  }
};

// =========================================
// 7️⃣ RESET PASSWORD
// =========================================
exports.resetPassword = async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  if (!phone || !otp || !newPassword) return res.status(400).json({ success: false, message: 'Data tidak lengkap' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT o.id, o.user_id, u.name, u.phone
       FROM otp_verifications o
       JOIN users u ON u.id = o.user_id
       WHERE u.phone = ? AND o.otp_code = ? AND o.is_used = 0 AND o.expired_at > NOW() AND o.type = 'reset'
       FOR UPDATE`,
      [phone, otp]
    );

    if (!rows.length) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'OTP tidak valid atau sudah digunakan' });
    }

    const data = rows[0];
    const hash = await bcrypt.hash(newPassword, 10);

    await conn.query(`UPDATE otp_verifications SET is_used = 1 WHERE id = ?`, [data.id]);
    await conn.query(`UPDATE users SET password = ? WHERE id = ?`, [hash, data.user_id]);

    await conn.commit();

    const waPhone = normalizePhone(data.phone);
    try {
      if (whatsappClient.isReady) await whatsappClient.sendPasswordChanged(waPhone, data.name);
    } catch (err) {
      logError(err, '[WA] sendPasswordChanged failed');
    }

    res.json({ success: true, message: 'Password berhasil diubah' });

  } catch (err) {
    if (conn) await conn.rollback();
    logError(err, 'Reset Password Error');
    res.status(500).json({ success: false, message: 'Reset password gagal' });
  } finally {
    if (conn) conn.release();
  }
};

// =========================================
// 8️⃣ ME (Get Current User)
// =========================================
exports.me = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token missing' });

    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } 
    catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const [rows] = await db.query('SELECT id, name, email, phone, is_verified FROM users WHERE id = ?', [decoded.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, user: rows[0] });

  } catch (err) {
    logError(err, 'ME Endpoint Error');
    res.status(500).json({ success: false, message: 'Gagal mengambil data user' });
  }
};
