const mongoose = require('mongoose');

const ticketResponseSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['user', 'admin'],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000,
  },
  attachments: [{ type: String }],
}, { timestamps: true });

const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ticketNumber: {
      type: String,
      unique: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: [
        'account',
        'payment',
        'campaign',
        'technical',
        'billing',
        'feature_request',
        'bug_report',
        'other',
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_on_user', 'waiting_on_admin', 'resolved', 'closed'],
      default: 'open',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 5000,
    },
    attachments: [{ type: String }],
    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Responses thread
    responses: [ticketResponseSchema],
    // Resolution
    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: { type: Date, default: null },
    // Satisfaction
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    ratingFeedback: { type: String, default: '' },
    // Metadata
    tags: [{ type: String, trim: true }],
    relatedCampaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },
    relatedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
  },
  { timestamps: true }
);

// Auto-generate ticket number
supportTicketSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model('SupportTicket').countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

supportTicketSchema.index({ user: 1, status: 1 });
supportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
supportTicketSchema.index({ assignedTo: 1 });
supportTicketSchema.index({ ticketNumber: 1 });
supportTicketSchema.index({ category: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
