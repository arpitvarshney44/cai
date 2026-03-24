const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const notificationCtrl = require('../controllers/notificationController');

// All routes require authentication
router.use(protect);

router.get('/', notificationCtrl.getNotifications);
router.get('/unread-count', notificationCtrl.getUnreadCount);
router.put('/read-all', notificationCtrl.markAllAsRead);
router.put('/preferences', notificationCtrl.updatePreferences);
router.put('/:notificationId/read', notificationCtrl.markAsRead);
router.delete('/:notificationId', notificationCtrl.deleteNotification);

module.exports = router;
