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
    // AI Feature Configs (arbitrary JSON per feature key)
    aiFeatureConfigs: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Feature flags
    featureFlags: {      aiMatching: { type: Boolean, default: true },
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
      welcome: { subject: { type: String, default: 'Welcome to Connect.AI' }, enabled: { type: Boolean, default: true }, body: { type: String, default: '' } },
      verification: { subject: { type: String, default: 'Verify your email' }, enabled: { type: Boolean, default: true }, body: { type: String, default: '' } },
      passwordReset: { subject: { type: String, default: 'Reset your password' }, enabled: { type: Boolean, default: true }, body: { type: String, default: '' } },
      campaignApproved: { subject: { type: String, default: 'Your campaign has been approved' }, enabled: { type: Boolean, default: true }, body: { type: String, default: '' } },
      paymentReceived: { subject: { type: String, default: 'Payment received' }, enabled: { type: Boolean, default: true }, body: { type: String, default: '' } },
      weeklyDigest: { subject: { type: String, default: 'Your weekly digest' }, enabled: { type: Boolean, default: false }, body: { type: String, default: '' } },
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
    // Campaign limits
    campaignLimits: {
      maxActiveCampaignsPerBrand: { type: Number, default: 10 },
      maxApplicationsPerCampaign: { type: Number, default: 100 },
      maxDeliverablesPerCampaign: { type: Number, default: 20 },
      minBudget: { type: Number, default: 1000 },
      maxBudget: { type: Number, default: 10000000 },
      maxCampaignDurationDays: { type: Number, default: 180 },
    },
    // Payment gateway config
    paymentGateway: {
      provider: { type: String, default: 'razorpay' },
      razorpayKeyId: { type: String, default: '' },
      razorpayKeySecret: { type: String, default: '' },
      webhookSecret: { type: String, default: '' },
      testMode: { type: Boolean, default: true },
    },
    // Platform fees
    platformFees: {
      featuredListingFee: { type: Number, default: 999 },
      urgentCampaignFee: { type: Number, default: 499 },
      verificationFee: { type: Number, default: 0 },
      adCampaignMinSpend: { type: Number, default: 500 },
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
