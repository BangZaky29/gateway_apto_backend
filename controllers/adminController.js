const db = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM admins WHERE email=?', [email], (err, rows) => {
    if (!rows.length) return res.status(404).json({ message: 'Admin not found' });

    if (!bcrypt.compareSync(password, rows[0].password))
      return res.status(401).json({ message: 'Wrong password' });

    const token = jwt.sign({ id: rows[0].id, role: 'admin' }, process.env.JWT_SECRET);
    res.json({ token });
  });
};

exports.payments = (req, res) => {
  db.query(
    `SELECT 
      pc.id,
      pc.payment_id,
      pc.email,
      pc.phone,
      pc.proof_image,
      pc.created_at
     FROM payment_confirmations pc
     LEFT JOIN payments p ON p.id = pc.payment_id
     WHERE p.status = 'pending' OR p.id IS NULL`,
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
};


exports.activate = (req, res) => {
  const { payment_id } = req.body;

  db.query(
    `SELECT p.*, pk.duration_days 
     FROM payments p
     JOIN packages pk ON pk.id=p.package_id
     WHERE p.id=?`,
    [payment_id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json({ message: 'Payment not found' });

      const p = rows[0];
      if (p.status === 'confirmed')
        return res.status(400).json({ message: 'Already activated' });

      const token = uuid();

      db.query(
        `INSERT INTO user_tokens (user_id,package_id,token,activated_at,expired_at)
         VALUES (?,?,?,NOW(),DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [p.user_id, p.package_id, token, p.duration_days]
      );

      db.query(`UPDATE payments SET status='confirmed' WHERE id=?`, [payment_id]);

      res.json({ message: 'Package activated', token });
    }
  );
};

