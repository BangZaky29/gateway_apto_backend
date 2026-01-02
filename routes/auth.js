const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

router.post('/register', auth.register);
router.post('/verify-otp', auth.verifyOtp);
router.post('/login', auth.login);
router.get('/me', auth.me);

module.exports = router;