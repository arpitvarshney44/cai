const Notification = require('../models/Notification');
const nodemailer = require('nodemailer');
const config = require('../config');

// Email transporter (lazy init)
let transporter = null;
const getTransporter = () => {
  if (!transporter && config.smtp.host && config.smtp.user) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
};

/**
 * Create a notification and optionally send push + email
 * @param {Object} options
 * @param {string} options.userId - Recipient user ID
 * @param {string} options.type - Notification type
 * @param {string} options.title - Notification title
 * @param {string} options.body - Notification body text
 * @param {Object} options.data - Deep link data { screen, referenceId, referenceType, extra }
 * @param {Object} options.io - Socket.io instance (optional)
 * @param {Object} options.emailOptions - { to, subject } for email (optional)
 */
const createNotification = async ({
  userId,
  type,
  title,
  body,
  data = {},
  io = null,
  emailOptions = null,
}) => {
  try {
    // Create in-app notification
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      body,
      data,
    });

    // Send real-time push via Socket.io
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        _id: notification._id,
        type,
        title,
        body,
        data,
        createdAt: notification.createdAt,
      });
      notification.pushSent = true;
    }

    // Send email notification if configured
    if (emailOptions) {
      try {
        const transport = getTransporter();
        if (transport) {
          await transport.sendMail({
            from: `"Connect.AI" <${config.smtp.user}>`,
            to: emailOptions.to,
            subject: emailOptions.subject || title,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 style="color: #000; font-size: 24px; font-weight: 800; margin: 0;">Connect.AI</h2>
                </div>
                <div style="background: #f9fafb; border-radius: 16px; padding: 30px; border: 1px solid #f3f4f6;">
                  <h3 style="color: #000; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">${title}</h3>
                  <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0;">${body}</p>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                  <p style="color: #9ca3af; font-size: 12px;">You received this email from Connect.AI notifications.</p>
                </div>
              </div>
            `,
          });
          notification.emailSent = true;
        }
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr.message);
      }
    }

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
};

/**
 * Create notifications for multiple users
 */
const createBulkNotifications = async ({ userIds, type, title, body, data = {}, io = null }) => {
  const promises = userIds.map((userId) =>
    createNotification({ userId, type, title, body, data, io })
  );
  return Promise.allSettled(promises);
};

module.exports = { createNotification, createBulkNotifications };
