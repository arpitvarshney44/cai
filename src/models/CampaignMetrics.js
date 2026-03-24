const mongoose = require('mongoose');

const campaignMetricsSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    influencer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Core metrics
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    // Financial
    spend: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    roi: { type: Number, default: 0 },
    costPerClick: { type: Number, default: 0 },
    costPerConversion: { type: Number, default: 0 },
    // Platform breakdown
    platformMetrics: [
      {
        platform: { type: String, enum: ['instagram', 'youtube', 'tiktok', 'twitter', 'facebook'] },
        impressions: { type: Number, default: 0 },
        reach: { type: Number, default: 0 },
        engagement: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
      },
    ],
    // Audience demographics
    audienceDemographics: {
      ageGroups: [{ range: String, percentage: Number }],
      genderSplit: { male: Number, female: Number, other: Number },
      topLocations: [{ location: String, percentage: Number }],
    },
    // Daily snapshots for charts
    dailySnapshots: [
      {
        date: { type: Date },
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        engagement: { type: Number, default: 0 },
      },
    ],
    // Period
    periodStart: { type: Date },
    periodEnd: { type: Date },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

campaignMetricsSchema.index({ campaign: 1 });
campaignMetricsSchema.index({ influencer: 1 });
campaignMetricsSchema.index({ campaign: 1, influencer: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('CampaignMetrics', campaignMetricsSchema);
