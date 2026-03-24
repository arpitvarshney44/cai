const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Webhook (no auth — Razorpay calls this)
router.post('/webhook', paymentController.razorpayWebhook);

// All routes below require auth
router.use(protect);

// Escrow payments
router.post('/escrow', authorize('brand'), paymentController.createEscrowPayment);
router.post('/verify', authorize('brand'), paymentController.verifyPayment);
router.put('/:paymentId/release', authorize('brand'), paymentController.releasePayment);
router.put('/:paymentId/refund', authorize('brand'), paymentController.refundPayment);

// Payment history & earnings
router.get('/', paymentController.getPaymentHistory);
router.get('/earnings', authorize('influencer'), paymentController.getEarnings);
router.get('/:paymentId', paymentController.getPayment);

module.exports = router;
