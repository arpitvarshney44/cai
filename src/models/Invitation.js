const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
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
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending',
    },
    respondedAt: { type: Date },
    expiresAt: { type: Date },
    proposedPrice: { type: Number, default: null },
  },
  { timestamps: true }
);

// One invitation per influencer per campaign
invitationSchema.index({ campaign: 1, influencer: 1 }, { unique: true });
invitationSchema.index({ influencer: 1, status: 1 });
invitationSchema.index({ brand: 1 });

module.exports = mongoose.model('Invitation', invitationSchema);
