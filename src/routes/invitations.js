const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/invitationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Brand: send invitation
router.post('/', authorize('brand'), ctrl.sendInvitation);

// Brand: sent invitations
router.get('/sent', authorize('brand'), ctrl.getSentInvitations);

// Influencer: received invitations
router.get('/received', authorize('influencer'), ctrl.getReceivedInvitations);

// Influencer: respond to invitation
router.put('/:id/respond', authorize('influencer'), ctrl.respondToInvitation);

module.exports = router;
