const express = require('express');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Connect.AI API is running' });
});

// Route modules
router.use('/auth', require('./auth'));
router.use('/admin', require('./admin'));
router.use('/influencer', require('./influencer'));
router.use('/brand', require('./brand'));
router.use('/profiles', require('./profiles'));
router.use('/campaigns', require('./campaigns'));
router.use('/applications', require('./applications'));
router.use('/invitations', require('./invitations'));
router.use('/deliverables', require('./deliverables'));
// router.use('/messages', require('./messages'));
// router.use('/payments', require('./payments'));

module.exports = router;
