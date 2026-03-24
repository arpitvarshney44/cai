const mongoose = require('mongoose');

const adCampaignSchema = new mongoose.Schema(
  {
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Ad campaign title is required'],
      trim: true,
      maxlength: 200,
    },
    description: { type: String, trim: true, maxlength: 1000 },
    // Budget
    budget: {
      total: { type: Number, required: true },
      daily: { type: Number, default: 0 },
      spent: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },
    // Targeting
    targeting: {
      niches: [{ type: String }],
      locations: [{ type: String }],
      ageRange: { min: { type: Number, default: 18 }, max: { type: Number, default: 65 } },
      gender: { type: String, enum: ['male', 'female', 'all'], default: 'all' },
      platforms: [{ type: String, enum: ['instagram', 'youtube', 'tiktok', 'twitter', 'facebook'] }],
    },
    // Creatives
    creatives: [
      {
        type: { type: String, enum: ['image', 'video', 'carousel'] },
        url: { type: String },
        thumbnail: { type: String },
        headline: { type: String, maxlength: 100 },
        callToAction: { type: String, maxlength: 50 },
      },
    ],
    // Schedule
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Status
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
    },
    // Performance metrics
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      ctr: { type: Number, default: 0 },
      cpc: { type: Number, default: 0 },
      cpm: { type: Number, default: 0 },
    },
    // Daily performance
    dailyMetrics: [
      {
        date: { type: Date },
        impressions: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        spend: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

adCampaignSchema.index({ brand: 1 });
adCampaignSchema.index({ status: 1 });
adCampaignSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('AdCampaign', adCampaignSchema);
