const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'message',           // New message received
        'application',       // New application on campaign
        'application_status', // Application accepted/rejected
        'invitation',        // New campaign invitation
        'contract',          // New contract / contract signed
        'deliverable',       // Deliverable submitted / approved / revision
        'campaign',          // Campaign status change
        'payment',           // Payment received / released
        'system',            // System announcements
        'profile',           // Profile verified / featured
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    // Data for deep linking in the app
    data: {
      screen: { type: String },       // Target screen name
      referenceId: { type: String },   // ID of the referenced entity
      referenceType: { type: String }, // Type: campaign, contract, conversation, etc.
      extra: { type: mongoose.Schema.Types.Mixed },
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // For push notifications
    pushSent: {
      type: Boolean,
      default: false,
    },
    // For email notifications
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
