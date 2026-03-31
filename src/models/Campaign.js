const mongoose = require('mongoose');

const deliverableSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['post', 'story', 'reel', 'video', 'blog', 'tweet', 'other'],
    required: true,
  },
  quantity: { type: Number, default: 1 },
  description: { type: String, trim: true },
  completed: { type: Boolean, default: false },
}, { _id: true });

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  dueDate: { type: Date },
  completed: { type: Boolean, default: false },
}, { _id: true });

const campaignSchema = new mongoose.Schema(
  {
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Campaign title is required'],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, 'Campaign description is required'],
      trim: true,
      maxlength: 3000,
    },
    niche: [{
      type: String,
      enum: [
        'fashion', 'beauty', 'fitness', 'food', 'travel', 'tech',
        'gaming', 'lifestyle', 'education', 'finance', 'health',
        'parenting', 'music', 'art', 'sports', 'entertainment', 'other',
      ],
    }],
    platform: [{
      type: String,
      enum: ['instagram', 'youtube', 'tiktok', 'twitter', 'facebook'],
    }],
    budget: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },
    deliverables: [deliverableSchema],
    milestones: [milestoneSchema],
    timeline: {
      startDate: { type: Date },
      endDate: { type: Date },
    },
    requirements: {
      minFollowers: { type: Number, default: 0 },
      minEngagementRate: { type: Number, default: 0 },
      location: { type: String, trim: true },
      gender: { type: String, enum: ['male', 'female', 'non-binary', 'any'], default: 'any' },
      ageRange: {
        min: { type: Number },
        max: { type: Number },
      },
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'paused', 'in_progress', 'completed', 'cancelled'],
      default: 'draft',
    },
    coverImage: { type: String, default: null },
    tags: [{ type: String, trim: true }],
    applicationsCount: { type: Number, default: 0 },
    maxApplications: { type: Number, default: 0 }, // 0 = unlimited
    isAdminApproved: { type: Boolean, default: false }, // requires admin approval
    isFlagged: { type: Boolean, default: false },
    moderationNote: { type: String, trim: true, maxlength: 500 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for efficient querying
campaignSchema.index({ brand: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ niche: 1 });
campaignSchema.index({ platform: 1 });
campaignSchema.index({ 'budget.min': 1, 'budget.max': 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Campaign', campaignSchema);
