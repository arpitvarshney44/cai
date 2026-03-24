const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

router.use(protect);

// Campaign analytics (brand)
router.get('/campaigns/:campaignId', authorize('brand'), analyticsController.getCampaignAnalytics);
router.get('/campaigns/:campaignId/export', authorize('brand'), analyticsController.exportCampaignAnalytics);
router.post('/campaigns/:campaignId/track', authorize('brand'), analyticsController.trackCampaignMetrics);
router.post('/campaigns/compare', authorize('brand'), analyticsController.compareCampaigns);

// Brand overview
router.get('/brand/overview', authorize('brand'), analyticsController.getBrandOverview);

// Influencer overview
router.get('/influencer/overview', authorize('influencer'), analyticsController.getInfluencerOverview);

module.exports = router;
