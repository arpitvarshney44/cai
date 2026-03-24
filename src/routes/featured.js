const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const featuredController = require('../controllers/featuredListingController');

// Public: get featured influencers
router.get('/', featuredController.getFeaturedInfluencers);

// Auth required
router.use(protect);

// Influencer
router.post('/', authorize('influencer'), featuredController.purchaseFeaturedListing);
router.get('/me', authorize('influencer'), featuredController.getMyFeaturedStatus);

// Admin
router.get('/admin', authorize('admin'), featuredController.adminGetFeaturedListings);
router.put('/:listingId/cancel', authorize('admin'), featuredController.adminCancelFeaturedListing);

module.exports = router;
