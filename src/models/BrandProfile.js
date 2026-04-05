const mongoose = require('mongoose');

const brandProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyName: { type: String, trim: true, maxlength: 100 },
    industry: { 
      type: String, 
      trim: true 
    },
    website: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 1000 },
    targetAudience: { type: String, trim: true, maxlength: 500 },
    logo: { type: String, default: null },
    coverImage: { type: String, default: null },
    socialLinks: {
      instagram: { type: String, trim: true },
      youtube: { type: String, trim: true },
      tiktok: { type: String, trim: true },
      twitter: { type: String, trim: true },
      facebook: { type: String, trim: true },
      linkedin: { type: String, trim: true },
    },
    location: {
      country: { type: String, trim: true },
      city: { type: String, trim: true },
    },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    completionPercentage: { type: Number, default: 0 },
    totalCampaigns: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Calculate completion percentage before save
brandProfileSchema.pre('save', function (next) {
  const fields = [
    this.companyName,
    this.industry,
    this.website,
    this.description,
    this.logo,
    this.location?.country,
    this.targetAudience,
  ];
  const filled = fields.filter(Boolean).length;
  this.completionPercentage = Math.round((filled / fields.length) * 100);
  next();
});

module.exports = mongoose.model('BrandProfile', brandProfileSchema);
