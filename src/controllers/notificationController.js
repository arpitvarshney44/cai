const Notification = require('../models/Notification');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

// @desc    Get notifications for current user
// @route   GET /api/v1/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { user: req.user._id };
    if (unreadOnly === 'true') filter.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);

    return success(res, {
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark a single notification as read
// @route   PUT /api/v1/notifications/:notificationId/read
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, user: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    return success(res, { notification }, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/v1/notifications/read-all
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    return success(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a notification
// @route   DELETE /api/v1/notifications/:notificationId
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.notificationId,
      user: req.user._id,
    });

    if (!notification) {
      return next(new AppError('Notification not found', 404));
    }

    return success(res, null, 'Notification deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notification count
// @route   GET /api/v1/notifications/unread-count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    return success(res, { unreadCount: count });
  } catch (error) {
    next(error);
  }
};

// @desc    Update notification preferences (placeholder for future)
// @route   PUT /api/v1/notifications/preferences
exports.updatePreferences = async (req, res, next) => {
  try {
    // For now, just acknowledge — preferences can be stored on User model later
    return success(res, null, 'Preferences updated');
  } catch (error) {
    next(error);
  }
};
