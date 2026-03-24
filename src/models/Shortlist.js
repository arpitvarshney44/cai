const mongoose = require('mongoose');

const shortlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'List name is required'],
      trim: true,
      maxlength: 100,
      default: 'Favorites',
    },
    influencers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InfluencerProfile',
    }],
  },
  { timestamps: true }
);

// One user can't have duplicate list names
shortlistSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Shortlist', shortlistSchema);
