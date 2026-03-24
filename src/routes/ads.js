const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const adController = require('../controllers/adCampaignController');

router.use(protect, authorize('brand'));

router.post('/', adController.createAdCampaign);
router.get('/', adController.getMyAdCampaigns);
router.get('/:adId', adController.getAdCampaign);
router.put('/:adId', adController.updateAdCampaign);
router.put('/:adId/status', adController.changeAdStatus);
router.get('/:adId/performance', adController.getAdPerformance);

module.exports = router;
