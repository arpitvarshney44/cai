const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    template: { type: String, default: 'custom' },
    status: { type: String, enum: ['sent', 'failed', 'pending'], default: 'pending' },
    error: { type: String, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    bulkId: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

emailLogSchema.index({ status: 1, createdAt: -1 });
emailLogSchema.index({ bulkId: 1 });
emailLogSchema.index({ to: 1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
