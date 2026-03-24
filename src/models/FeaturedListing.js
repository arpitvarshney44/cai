const mongoose = require('mongoose');

const featuredListingSchema = new mongoose.Schema(
  {
    influencer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },
    position: { type: Number, default: 0 }, // display priority
  },
  { timestamps: true }
);

featuredListingSchema.index({ influencer: 1 });
featuredListingSchema.index({ status: 1 });
featuredListingSchema.index({ endDate: 1 });

module.exports = mongoose.model('FeaturedListing', featuredListingSchema);
