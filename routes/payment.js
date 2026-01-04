const express = require('express');
const router = express.Router();
const payment = require('../controllers/paymentController');
const auth = require('../middlewares/authMiddleware');

// CREATE PAYMENT
router.post('/create', auth, payment.create);

// CHECK ACTIVE PACKAGE
router.get('/user/active-package', auth, payment.checkActivePackage);

// CONFIRM PAYMENT (upload bukti)
router.post('/confirm', auth, payment.confirm);

// GET USER PAYMENTS
router.get('/user/payments', auth, payment.getUserPayments);

// DOWNLOAD INVOICE
router.get('/:paymentId/invoice', auth, payment.getInvoice);

// ADMIN APPROVE PAYMENT
router.post('/admin/activate', auth, payment.adminActivatePayment);



module.exports = router;
