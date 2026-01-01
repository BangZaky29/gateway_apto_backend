const db = require('../config/db');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});

const upload = multer({ storage });

exports.create = (req, res) => { 
  const { package_id, method } = req.body;

  db.query(
    `INSERT INTO payments (user_id, package_id, payment_method, amount, status)
     SELECT ?, id, ?, price, 'pending'
     FROM packages WHERE id=?`,
    [req.user.id, method, package_id],
    (err, result) => {
      if (err || result.affectedRows === 0)
        return res.status(400).json({ message: 'Invalid package' });

      res.json({
        message: 'Payment created',
        payment_id: result.insertId
      });
    }
  );
};


exports.confirm = [
  upload.single('proof'),
  (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: 'Proof required' });

    const { payment_id, email, phone } = req.body;

    db.query(
      `INSERT INTO payment_confirmations 
       (payment_id,email,phone,proof_image) 
       VALUES (?,?,?,?)`,
      [payment_id, email, phone, req.file.filename],
      () => res.json({ message: 'Confirmation sent' })
    );
  },
];


