const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const discoveryCtrl = require('../controllers/discoveryController');
const shortlistCtrl = require('../controllers/shortlistController');

// Discovery — requires auth
router.get('/influencers', protect, discoveryCtrl.discoverInfluencers);
router.get('/influencers/:profileId', protect, discoveryCtrl.getInfluencerDetail);

// Shortlists
router.get('/shortlists', protect, shortlistCtrl.getMyShortlists);
router.post('/shortlists', protect, shortlistCtrl.createShortlist);
router.post('/shortlists/:listId/add', protect, shortlistCtrl.addToShortlist);
router.post('/shortlists/:listId/remove', protect, shortlistCtrl.removeFromShortlist);
router.delete('/shortlists/:listId', protect, shortlistCtrl.deleteShortlist);

// Quick favorite toggle
router.post('/favorites/toggle', protect, shortlistCtrl.toggleFavorite);

module.exports = router;
