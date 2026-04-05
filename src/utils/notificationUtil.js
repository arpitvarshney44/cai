const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushNotification } = require('./firebase');
const sendEmail = require('./sendEmail');
const emailTemplates = require('./emailTemplates');

/**
 * Common utility to create a notification in DB AND send push/email notification.
 * @param {string} userId - Target user ID (recipient)
 * @param {object} options - { type, title, body, data: { screen, referenceId, referenceType, extra } }
 */
const createNotification = async (userId, { type, title, body, data = {} }) => {
  try {
    // 1. Save notification in database
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      body,
      data,
    });

    // 2. Get the user for token/email
    const user = await User.findById(userId).select('fcmToken email name');

    if (!user) {
      console.warn(`[Notification] User ${userId} not found for notification.`);
      return notification;
    }

    // 3. Send Push Notification
    if (user.fcmToken) {
      const fcmData = {
        screen: data.screen || '',
        referenceId: data.referenceId || '',
        referenceType: data.referenceType || '',
        notificationId: notification._id.toString(),
      };

      const pushResult = await sendPushNotification(user.fcmToken, {
        title,
        body,
        data: fcmData,
      });

      if (pushResult) {
        notification.pushSent = true;
      }
    }

    // 4. Send Email Notification (Optional, for critical types)
    const criticalTypes = ['application_status', 'payment', 'contract', 'invitation'];
    if (criticalTypes.includes(type) && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: `Connect.AI - ${title}`,
          html: emailTemplates.genericNotification(user.name, title, body),
        });
        notification.emailSent = true;
      } catch (err) {
        console.error('Email notification failed:', err.message);
      }
    }

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

module.exports = { createNotification };
