const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Influencer: apply
router.post('/', authorize('influencer'), ctrl.applyToCampaign);

// Influencer: my applications
router.get('/my', authorize('influencer'), ctrl.getMyApplications);

// Influencer: withdraw
router.put('/:id/withdraw', authorize('influencer'), ctrl.withdrawApplication);

// Brand: view applicants for a campaign
router.get('/campaign/:campaignId', authorize('brand'), ctrl.getCampaignApplications);

// Brand: accept/reject
router.put('/:id/respond', authorize('brand'), ctrl.respondToApplication);

module.exports = router;
