const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const subController = require('../controllers/subscriptionController');

// Webhook (no auth)
router.post('/webhook', subController.subscriptionWebhook);

// All routes below require auth
router.use(protect);

router.get('/plans', subController.getPlans);
router.get('/me', subController.getMySubscription);
router.post('/', subController.subscribe);
router.put('/cancel', subController.cancelSubscription);

module.exports = router;
