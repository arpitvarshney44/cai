const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // General settings
    commissionRate: { type: Number, default: 10 }, // percentage
    minWithdrawal: { type: Number, default: 500 }, // INR
    maxWithdrawal: { type: Number, default: 500000 },
    // Subscription prices
    subscriptionPrices: {
      brand: {
        pro: { monthly: { type: Number, default: 2999 }, yearly: { type: Number, default: 29990 } },
        enterprise: { monthly: { type: Number, default: 9999 }, yearly: { type: Number, default: 99990 } },
      },
      influencer: {
        pro: { monthly: { type: Number, default: 999 }, yearly: { type: Number, default: 9990 } },
      },
    },
    // Feature flags
    featureFlags: {
      aiMatching: { type: Boolean, default: true },
      aiScoring: { type: Boolean, default: true },
      aiChatAssistant: { type: Boolean, default: true },
      aiContentAnalysis: { type: Boolean, default: true },
      aiBriefGenerator: { type: Boolean, default: true },
      affiliateSystem: { type: Boolean, default: true },
      featuredListings: { type: Boolean, default: true },
      adCampaigns: { type: Boolean, default: true },
      socialMediaSync: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      emailNotifications: { type: Boolean, default: true },
      escrowPayments: { type: Boolean, default: true },
    },
    // Maintenance
    maintenanceMode: { type: Boolean, default: false },
    maintenanceMessage: { type: String, default: 'We are currently performing maintenance. Please try again later.' },
    // Email templates
    emailTemplates: {
      welcome: { subject: { type: String, default: 'Welcome to Connect.AI' }, enabled: { type: Boolean, default: true } },
      verification: { subject: { type: String, default: 'Verify your email' }, enabled: { type: Boolean, default: true } },
      passwordReset: { subject: { type: String, default: 'Reset your password' }, enabled: { type: Boolean, default: true } },
      campaignApproved: { subject: { type: String, default: 'Your campaign has been approved' }, enabled: { type: Boolean, default: true } },
      paymentReceived: { subject: { type: String, default: 'Payment received' }, enabled: { type: Boolean, default: true } },
      weeklyDigest: { subject: { type: String, default: 'Your weekly digest' }, enabled: { type: Boolean, default: false } },
    },
    // Notification settings
    notificationSettings: {
      adminEmailAlerts: { type: Boolean, default: true },
      criticalAlertEmail: { type: String, default: '' },
      dailyReportEnabled: { type: Boolean, default: false },
      weeklyReportEnabled: { type: Boolean, default: true },
    },
    // Rate limits
    rateLimits: {
      apiRequestsPerMinute: { type: Number, default: 100 },
      loginAttemptsPerHour: { type: Number, default: 10 },
      messagePerMinute: { type: Number, default: 30 },
    },
    // Last updated by
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
