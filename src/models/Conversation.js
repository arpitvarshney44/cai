const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },
    // Optional: link conversation to a campaign for context
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },
    // Track unread counts per participant
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    // Track typing status per participant (not persisted long-term, but useful for queries)
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for fast lookup of user's conversations
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

// Ensure we don't create duplicate conversations between same two users
conversationSchema.statics.findOrCreateDM = async function (userId1, userId2, campaignId = null) {
  // Sort IDs to ensure consistent lookup regardless of order
  const sortedParticipants = [userId1, userId2].sort();

  let conversation = await this.findOne({
    participants: { $all: sortedParticipants, $size: 2 },
    ...(campaignId ? { campaign: campaignId } : { campaign: null }),
  });

  if (!conversation) {
    conversation = await this.create({
      participants: sortedParticipants,
      campaign: campaignId,
      unreadCounts: new Map([
        [userId1.toString(), 0],
        [userId2.toString(), 0],
      ]),
    });
  }

  return conversation;
};

module.exports = mongoose.model('Conversation', conversationSchema);
