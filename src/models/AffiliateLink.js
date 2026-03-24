const mongoose = require('mongoose');
const crypto = require('crypto');

const affiliateLinkSchema = new mongoose.Schema(
  {
    influencer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    code: {
      type: String,
      unique: true,
      default: () => crypto.randomBytes(6).toString('hex'),
    },
    originalUrl: { type: String, default: '' },
    clicks: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    commissionPercent: { type: Number, default: 10 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

affiliateLinkSchema.index({ influencer: 1 });
affiliateLinkSchema.index({ campaign: 1 });
affiliateLinkSchema.index({ code: 1 });

module.exports = mongoose.model('AffiliateLink', affiliateLinkSchema);
