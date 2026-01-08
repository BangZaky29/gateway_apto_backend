// =========================================
// FILE: routes/auth.js (UPGRADED)
// Complete Auth Routes with Forgot Password
// =========================================

const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

// Registration & Verification
router.post('/register', auth.register);
router.post('/verify-otp', auth.verifyOtp);
router.post('/resend-otp', auth.resendOtp);

// Login
router.post('/login', auth.login);

// Profile
router.get('/me', auth.me);

// 🆕 Forgot Password Flow
router.post('/forgot-password', auth.forgotPassword);
router.post('/verify-reset-otp', auth.verifyResetOtp);
router.post('/reset-password', auth.resetPassword);

module.exports = router;