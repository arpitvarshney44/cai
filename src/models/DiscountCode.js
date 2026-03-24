const mongoose = require('mongoose');

const discountCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    influencer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    maxUsage: { type: Number, default: 0 }, // 0 = unlimited
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

discountCodeSchema.index({ code: 1 });
discountCodeSchema.index({ campaign: 1 });
discountCodeSchema.index({ brand: 1 });
discountCodeSchema.index({ influencer: 1 });

module.exports = mongoose.model('DiscountCode', discountCodeSchema);
