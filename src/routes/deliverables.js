const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/deliverableController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Influencer: submit deliverable
router.post('/', authorize('influencer'), ctrl.submitDeliverable);

// Influencer: my deliverables
router.get('/my', authorize('influencer'), ctrl.getMyDeliverables);

// Brand or Influencer: list deliverables for campaign
router.get('/campaign/:campaignId', ctrl.getCampaignDeliverables);

// Brand: review deliverable
router.put('/:id/review', authorize('brand'), ctrl.reviewDeliverable);

module.exports = router;
