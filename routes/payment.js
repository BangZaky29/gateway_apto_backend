const express = require('express');
const router = express.Router();
const payment = require('../controllers/paymentController');
const auth = require('../middlewares/authMiddleware');

router.post('/create', auth, payment.create);

// ⬇️ spread array middleware
router.post('/confirm', auth, ...payment.confirm);

module.exports = router;
