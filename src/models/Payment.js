const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
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
      required: true,
    },
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      default: null,
    },
    // Payment details
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD'],
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    platformFeePercent: {
      type: Number,
      default: 10,
    },
    influencerPayout: {
      type: Number,
      default: 0,
    },
    // Razorpay fields
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    // Escrow status
    status: {
      type: String,
      enum: [
        'pending',        // Order created, awaiting payment
        'escrow_held',    // Payment received, held in escrow
        'released',       // Released to influencer
        'refunded',       // Refunded to brand
        'partially_refunded',
        'failed',         // Payment failed
        'cancelled',      // Cancelled before payment
      ],
      default: 'pending',
    },
    type: {
      type: String,
      enum: ['escrow', 'direct', 'subscription', 'featured_listing'],
      default: 'escrow',
    },
    // Release tracking
    releasedAt: { type: Date, default: null },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releaseNote: { type: String, default: '' },
    // Refund tracking
    refundedAt: { type: Date, default: null },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: '' },
    refundId: { type: String, default: null },
    // Payout to influencer
    payoutStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    payoutId: { type: String, default: null },
    payoutCompletedAt: { type: Date, default: null },
    // Metadata
    description: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ campaign: 1 });
paymentSchema.index({ brand: 1 });
paymentSchema.index({ influencer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
