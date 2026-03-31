const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // User actions
        'user_blocked',
        'user_unblocked',
        'user_deleted',
        'user_verified',
        'user_profile_edited',
        'admin_created',
        // Campaign actions
        'campaign_approved',
        'campaign_rejected',
        'campaign_flagged',
        'campaign_unflagged',
        'campaign_removed',
        // Application actions
        'application_override_approved',
        'application_override_rejected',
        'application_flagged_spam',
        // Payment actions
        'payment_released',
        'payment_refunded',
        'payout_processed',
        // Moderation actions
        'report_reviewed',
        'report_dismissed',
        'warning_issued',
        'content_removed',
        // Support actions
        'ticket_assigned',
        'ticket_responded',
        'ticket_resolved',
        'ticket_closed',
        // Settings actions
        'settings_updated',
        'feature_flag_toggled',
        'maintenance_toggled',
        // AI actions
        'ai_batch_scoring',
        'ai_model_retrained',
        // System
        'admin_login',
        'admin_logout',
        'export_data',
        'bulk_action',
      ],
    },
    targetType: {
      type: String,
      enum: ['user', 'campaign', 'application', 'payment', 'report', 'ticket', 'settings', 'system'],
      default: 'system',
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    // Snapshot of changes
    previousData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Request metadata
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    // Severity
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ admin: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ severity: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
