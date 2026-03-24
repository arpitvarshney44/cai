const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema(
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
    // Contract terms
    title: {
      type: String,
      required: [true, 'Contract title is required'],
      trim: true,
      maxlength: 200,
    },
    terms: {
      type: String,
      required: [true, 'Contract terms are required'],
      trim: true,
    },
    deliverables: [
      {
        description: { type: String, required: true },
        platform: { type: String },
        dueDate: { type: Date },
        quantity: { type: Number, default: 1 },
      },
    ],
    compensation: {
      amount: { type: Number, required: true },
      currency: { type: String, default: 'USD' },
      paymentTerms: { type: String, default: 'Upon completion' },
    },
    timeline: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    // Signing status
    status: {
      type: String,
      enum: ['draft', 'pending_influencer', 'pending_brand', 'active', 'completed', 'cancelled', 'disputed'],
      default: 'draft',
    },
    brandSignature: {
      signed: { type: Boolean, default: false },
      signedAt: { type: Date },
      ipAddress: { type: String },
    },
    influencerSignature: {
      signed: { type: Boolean, default: false },
      signedAt: { type: Date },
      ipAddress: { type: String },
    },
    // Revision history
    revisions: [
      {
        revisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changes: { type: String },
        revisedAt: { type: Date, default: Date.now },
      },
    ],
    // Additional clauses
    exclusivity: { type: Boolean, default: false },
    usageRights: { type: String, default: '' },
    cancellationPolicy: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

contractSchema.index({ campaign: 1 });
contractSchema.index({ brand: 1 });
contractSchema.index({ influencer: 1 });
contractSchema.index({ status: 1 });

module.exports = mongoose.model('Contract', contractSchema);
