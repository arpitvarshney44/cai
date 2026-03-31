const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    influencer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pitch: {
      type: String,
      required: [true, 'Pitch message is required'],
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
    brandNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isSpam: { type: Boolean, default: false },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

// One application per influencer per campaign
applicationSchema.index({ campaign: 1, influencer: 1 }, { unique: true });
applicationSchema.index({ influencer: 1, status: 1 });
applicationSchema.index({ campaign: 1, status: 1 });

module.exports = mongoose.model('Application', applicationSchema);
