const mongoose = require('mongoose');

const socialAccountSchema = new mongoose.Schema({
  platform: { type: String, enum: ['instagram', 'youtube', 'tiktok', 'twitter', 'facebook'] },
  handle: { type: String, trim: true },
  url: { type: String, trim: true },
  followers: { type: Number, default: 0 },
  engagementRate: { type: Number, default: 0 },
  isConnected: { type: Boolean, default: false },
  connectedAt: { type: Date },
}, { _id: false });

const portfolioItemSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video', 'link'], required: true },
  url: { type: String, required: true },
  thumbnail: { type: String },
  caption: { type: String, trim: true },
  platform: { type: String },
}, { timestamps: true });

const influencerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    bio: { type: String, trim: true, maxlength: 500 },
    niche: [{
      type: String,
      enum: [
        'fashion', 'beauty', 'fitness', 'food', 'travel', 'tech',
        'gaming', 'lifestyle', 'education', 'finance', 'health',
        'parenting', 'music', 'art', 'sports', 'entertainment', 'other',
      ],
    }],
    location: {
      country: { type: String, trim: true },
      city: { type: String, trim: true },
    },
    languages: [{ type: String, trim: true }],
    gender: { type: String, enum: ['male', 'female', 'non-binary', 'prefer_not_to_say'] },
    dateOfBirth: { type: Date },
    profileImage: { type: String, default: null },
    coverImage: { type: String, default: null },
    socialAccounts: [socialAccountSchema],
    portfolio: [portfolioItemSchema],
    totalFollowers: { type: Number, default: 0 },
    avgEngagementRate: { type: Number, default: 0 },
    aiScore: { type: Number, default: 0, min: 0, max: 100 },
    pricePerPost: { type: Number, default: 0 },
    pricePerStory: { type: Number, default: 0 },
    pricePerVideo: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    completionPercentage: { type: Number, default: 0 },
    totalCampaigns: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Calculate completion percentage before save
influencerProfileSchema.pre('save', function (next) {
  const fields = [
    this.bio,
    this.niche?.length > 0,
    this.location?.country,
    this.profileImage,
    this.socialAccounts?.length > 0,
    this.portfolio?.length > 0,
    this.languages?.length > 0,
    this.gender,
  ];
  const filled = fields.filter(Boolean).length;
  this.completionPercentage = Math.round((filled / fields.length) * 100);
  next();
});

// Recalculate total followers & avg engagement from social accounts
influencerProfileSchema.methods.recalculateStats = function () {
  if (!this.socialAccounts?.length) return;
  this.totalFollowers = this.socialAccounts.reduce((sum, a) => sum + (a.followers || 0), 0);
  const rates = this.socialAccounts.filter(a => a.engagementRate > 0);
  this.avgEngagementRate = rates.length
    ? rates.reduce((sum, a) => sum + a.engagementRate, 0) / rates.length
    : 0;
};

module.exports = mongoose.model('InfluencerProfile', influencerProfileSchema);
