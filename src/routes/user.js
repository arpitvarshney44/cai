const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { success } = require('../utils/apiResponse');

/**
 * @desc    Update FCM token for current user
 * @route   POST /api/v1/users/fcm-token
 */
router.post('/fcm-token', protect, async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    
    await User.findByIdAndUpdate(req.user._id, { fcmToken });

    return success(res, null, 'FCM token updated successfully');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
