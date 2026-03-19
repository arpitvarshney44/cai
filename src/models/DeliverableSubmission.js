const mongoose = require('mongoose');

const deliverableSubmissionSchema = new mongoose.Schema(
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
    deliverableType: {
      type: String,
      enum: ['post', 'story', 'reel', 'video', 'blog', 'tweet', 'other'],
      required: true,
    },
    contentLink: {
      type: String,
      trim: true,
      required: [true, 'Content link is required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['submitted', 'approved', 'revision_needed', 'rejected'],
      default: 'submitted',
    },
    brandFeedback: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

deliverableSubmissionSchema.index({ campaign: 1, influencer: 1 });
deliverableSubmissionSchema.index({ campaign: 1, status: 1 });

module.exports = mongoose.model('DeliverableSubmission', deliverableSubmissionSchema);
