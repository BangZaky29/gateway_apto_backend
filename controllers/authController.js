const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtp } = require('../utils/otp');

exports.register = (req, res) => {
  const { name, email, phone, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.query(
    'INSERT INTO users (name,email,phone,password) VALUES (?,?,?,?)',
    [name, email, phone, hash],
    (err, result) => {
      if (err) return res.status(400).json(err);

      const otp = generateOtp();
      db.query(
        'INSERT INTO otp_verifications (user_id,otp_code,expired_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
        [result.insertId, otp]
      );

      // ⚠️ nanti diganti send WA API
      console.log('OTP:', otp);

      res.json({ message: 'Register success, OTP sent' });
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
