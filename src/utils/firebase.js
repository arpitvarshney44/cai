const admin = require('firebase-admin');

/**
 * To initialize Firebase Admin, you need a service account key file.
 * We'll use environment variables for security.
 */

if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FCM_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FCM_SERVICE_ACCOUNT) 
      : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized successfully');
    } else {
      console.warn('Firebase Admin NOT initialized: FCM_SERVICE_ACCOUNT not found in environment');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error.message);
  }
}

/**
 * Sends a push notification to a specific FCM token
 * @param {string} token 
 * @param {object} payload { title, body, data }
 */
const sendPushNotification = async (token, { title, body, data = {} }) => {
  if (!admin.apps.length || !token) return;

  const message = {
    notification: { title, body },
    data,
    token,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default_channel',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error.message);
    // If token is invalid/not registered, you might want to remove it from user model
    return null;
  }
};

module.exports = { admin, sendPushNotification };
