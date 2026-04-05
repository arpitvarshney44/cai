const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const affiliateController = require('../controllers/affiliateController');

// Public: track click (no auth)
router.get('/track/:code', affiliateController.trackClick);

// All routes below require auth
router.use(protect);

// Affiliate links (influencer)
router.post('/links', authorize('influencer'), affiliateController.createAffiliateLink);
router.get('/links', authorize('influencer'), affiliateController.getMyAffiliateLinks);
router.post('/convert/:code', affiliateController.recordConversion);

// Discount codes (brand)
router.post('/discounts', authorize('brand'), affiliateController.createDiscountCode);
router.get('/discounts', authorize('brand'), affiliateController.getDiscountCodes);
router.put('/discounts/:id/revoke', authorize('brand'), affiliateController.revokeDiscountCode);
router.delete('/discounts/:id', authorize('brand'), affiliateController.deleteDiscountCode);
router.post('/discounts/validate', affiliateController.validateDiscountCode);

// Discount codes assigned to influencer
router.get('/my-codes', authorize('influencer'), affiliateController.getMyAssignedCodes);

module.exports = router;
