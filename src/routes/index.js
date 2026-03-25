const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Connect.AI API is running' });
});

// Route modules
router.use('/dashboard', require('./dashboard'));
router.use('/auth', require('./auth'));
router.use('/users', require('./user'));
router.use('/admin', require('./admin'));
router.use('/influencer', require('./influencer'));
router.use('/brand', require('./brand'));
router.use('/profiles', require('./profiles'));
router.use('/campaigns', require('./campaigns'));
router.use('/applications', require('./applications'));
router.use('/invitations', require('./invitations'));
router.use('/deliverables', require('./deliverables'));
router.use('/discovery', require('./discovery'));
router.use('/messages', require('./messages'));
router.use('/contracts', require('./contracts'));
router.use('/notifications', require('./notifications'));
router.use('/payments', require('./payments'));
router.use('/subscriptions', require('./subscriptions'));
router.use('/affiliates', require('./affiliates'));
router.use('/featured', require('./featured'));
router.use('/analytics', require('./analytics'));
router.use('/ads', require('./ads'));
router.use('/ai', require('./ai'));
router.use('/support', require('./support'));

module.exports = router;
