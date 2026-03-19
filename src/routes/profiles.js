const express = require('express');
const router = express.Router();
const influencerCtrl = require('../controllers/influencerProfileController');
const brandCtrl = require('../controllers/brandProfileController');

// Public profile views — no auth required
router.get('/influencer/:userId', influencerCtrl.getPublicProfile);
router.get('/brand/:userId', brandCtrl.getPublicProfile);

module.exports = router;
