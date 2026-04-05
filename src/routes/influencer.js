const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/influencerProfileController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

router.use(protect, authorize('influencer'));

router.get('/profile/me', ctrl.getMyProfile);
router.put('/profile', ctrl.upsertProfile);
router.post('/profile/upload-image', upload.single('image'), ctrl.uploadProfileImage);
router.post('/profile/portfolio', upload.single('thumbnail'), ctrl.addPortfolioItem);
router.delete('/profile/portfolio/:itemId', ctrl.removePortfolioItem);
router.put('/profile/social', ctrl.updateSocialAccounts);
router.post('/profile/saved-campaigns/:campaignId', ctrl.toggleSaveCampaign);
router.get('/profile/saved-campaigns', ctrl.getSavedCampaigns);

// Public route (no auth needed) — must be after the protected block
module.exports = router;
