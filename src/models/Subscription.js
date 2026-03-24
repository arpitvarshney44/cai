const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      required: true,
    },
    role: {
      type: String,
      enum: ['brand', 'influencer'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired', 'past_due', 'trialing'],
      default: 'active',
    },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    interval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    // Razorpay subscription
    razorpaySubscriptionId: { type: String, default: null },
    razorpayPlanId: { type: String, default: null },
    // Plan limits
    limits: {
      maxCampaigns: { type: Number, default: 3 },       // brand
      maxApplications: { type: Number, default: 10 },    // influencer
      maxShortlists: { type: Number, default: 1 },       // brand
      featuredListing: { type: Boolean, default: false }, // influencer
      advancedAnalytics: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },  // brand enterprise
    },
    paymentHistory: [
      {
        amount: Number,
        paidAt: { type: Date, default: Date.now },
        razorpayPaymentId: String,
        status: { type: String, enum: ['success', 'failed'], default: 'success' },
      },
    ],
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ plan: 1 });
subscriptionSchema.index({ endDate: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
