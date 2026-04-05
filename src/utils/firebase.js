const admin = require('firebase-admin');

/**
 * To initialize Firebase Admin, you need a service account key file.
 * We'll use environment variables for security.
 */

if (!admin.apps.length) {
  try {
    let serviceAccount = null;
    try {
      if (process.env.FCM_SERVICE_ACCOUNT) {
        // Handle single quote wraps often used for multi-line .env vars
        const raw = process.env.FCM_SERVICE_ACCOUNT.trim().replace(/^'|'$/g, '');
        serviceAccount = JSON.parse(raw);
      }
    } catch (parseError) {
      console.error('CRITICAL: Failed to parse FCM_SERVICE_ACCOUNT from .env. Ensure it is a valid JSON string.');
      console.error('Parse error:', parseError.message);
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized successfully (Project:', serviceAccount.project_id, ')');
    } else {
      console.warn('Firebase Admin NOT initialized: FCM_SERVICE_ACCOUNT missing or invalid in environment');
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
    // No 'notification' key — data-only message so the OS never shows a foreground popup.
    // The app handles delivery silently via socket + in-app notification inbox.
    data: {
      ...Object.fromEntries(
        Object.entries({ title, body, ...data }).map(([k, v]) => [k, String(v)])
      ),
    },
    token,
    android: {
      priority: 'high',
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    return response;
  } catch (error) {
    console.error('[Push Error] Single push failed:', error.message);
    if (error.code === 'messaging/registration-token-not-registered') {
      console.warn(`[Push] Token ${token.substring(0, 10)}... is no longer valid.`);
    }
    return null;
  }
};

/**
 * Sends a push notification to multiple FCM tokens
 * @param {string[]} tokens 
 * @param {object} payload { title, body, data }
 */
const sendMulticastPush = async (tokens, { title, body, data = {} }) => {
  if (!admin.apps.length || !tokens?.length) return;

  const message = {
    // Data-only — no foreground popup shown by the OS.
    data: {
      ...Object.fromEntries(
        Object.entries({ title, body, ...data }).map(([k, v]) => [k, String(v)])
      ),
    },
    tokens: tokens.filter(t => t),
    android: {
      priority: 'high',
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return response;
  } catch (error) {
    console.error('[Multicast Error] Bulk push failed:', error.message);
    return null;
  }
};

module.exports = { admin, sendPushNotification, sendMulticastPush };
