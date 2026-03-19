const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/campaignController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createCampaignValidator,
  updateCampaignValidator,
  listCampaignsValidator,
} = require('../validators/campaignValidator');

// All routes require authentication
router.use(protect);

// Brand-only routes
router.post(
  '/',
  authorize('brand'),
  validate(createCampaignValidator),
  ctrl.createCampaign
);

router.get(
  '/my',
  authorize('brand'),
  ctrl.getMyCampaigns
);

router.put(
  '/:id',
  authorize('brand'),
  validate(updateCampaignValidator),
  ctrl.updateCampaign
);

router.delete(
  '/:id',
  authorize('brand'),
  ctrl.deleteCampaign
);

// Accessible by all authenticated users
router.get(
  '/',
  validate(listCampaignsValidator),
  ctrl.listCampaigns
);

router.get('/:id', ctrl.getCampaign);

module.exports = router;
