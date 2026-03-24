const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // What is being reported
    targetType: {
      type: String,
      enum: ['user', 'campaign', 'message', 'content', 'review'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // Reported user (for quick lookups)
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      enum: [
        'spam',
        'harassment',
        'inappropriate_content',
        'fake_profile',
        'scam',
        'hate_speech',
        'violence',
        'copyright',
        'impersonation',
        'other',
      ],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Evidence
    screenshots: [{ type: String }],
    // Moderation
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    // Admin handling
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    resolution: {
      type: String,
      enum: ['warning_issued', 'content_removed', 'user_banned', 'no_action', 'escalated'],
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Action taken
    actionTaken: {
      userBlocked: { type: Boolean, default: false },
      contentRemoved: { type: Boolean, default: false },
      warningIssued: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, priority: -1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reporter: 1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Report', reportSchema);
