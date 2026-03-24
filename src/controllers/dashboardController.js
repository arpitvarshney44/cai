const Campaign = require('../models/Campaign');
const CampaignMetrics = require('../models/CampaignMetrics');
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const Contract = require('../models/Contract');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const { success } = require('../utils/apiResponse');

// @desc    Get dashboard data for current user (brand or influencer)
// @route   GET /api/v1/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;

    if (role === 'brand') {
      return getBrandDashboard(userId, res, next);
    }
    return getInfluencerDashboard(userId, res, next);
  } catch (error) {
    next(error);
  }
};

async function getBrandDashboard(userId, res, next) {
  try {
    const [
      campaigns,
      metricsAgg,
      spendAgg,
      unreadMessages,
      unreadNotifications,
      activeContracts,
      recentNotifications,
    ] = await Promise.all([
      Campaign.find({ brand: userId }).select('_id title status createdAt').lean(),
      CampaignMetrics.aggregate([
        {
          $lookup: {
            from: 'campaigns',
            localField: 'campaign',
            foreignField: '_id',
            as: 'camp',
          },
        },
        { $unwind: '$camp' },
        { $match: { 'camp.brand': userId } },
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: '$impressions' },
            totalReach: { $sum: '$reach' },
            totalClicks: { $sum: '$clicks' },
            totalEngagement: { $sum: '$engagement' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { brand: userId, status: { $in: ['escrow_held', 'released'] } } },
        { $group: { _id: null, totalSpent: { $sum: '$amount' } } },
      ]),
      Conversation.aggregate([
        { $match: { participants: userId } },
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessage',
            foreignField: '_id',
            as: 'lastMsg',
          },
        },
        { $unwind: { path: '$lastMsg', preserveNullAndEmptyArrays: true } },
        { $match: { 'lastMsg.sender': { $ne: userId }, 'lastMsg.readBy': { $not: { $elemMatch: { $eq: userId } } } } },
        { $count: 'count' },
      ]),
      Notification.countDocuments({ user: userId, read: false }),
      Contract.countDocuments({
        $or: [{ brand: userId }],
        status: { $in: ['pending', 'active'] },
      }),
      Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // Unique creators (from accepted applications)
    const uniqueCreators = await Application.distinct('influencer', {
      status: 'accepted',
      campaign: { $in: campaigns.map((c) => c._id) },
    });

    const metrics = metricsAgg[0] || {};
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

    return success(res, {
      role: 'brand',
      stats: {
        totalCampaigns,
        activeCampaigns,
        totalCreators: uniqueCreators.length,
        totalReach: metrics.totalReach || 0,
        totalImpressions: metrics.totalImpressions || 0,
        totalSpent: spendAgg[0]?.totalSpent || 0,
        unreadMessages: unreadMessages[0]?.count || 0,
        unreadNotifications,
        activeContracts,
      },
      recentActivity: recentNotifications.map((n) => ({
        _id: n._id,
        type: n.type,
        title: n.title || n.message,
        time: n.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

async function getInfluencerDashboard(userId, res, next) {
  try {
    const [
      metricsAgg,
      totalEarned,
      pendingEarnings,
      acceptedApps,
      unreadMessages,
      unreadNotifications,
      activeContracts,
      recentNotifications,
    ] = await Promise.all([
      CampaignMetrics.aggregate([
        { $match: { influencer: userId } },
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: '$impressions' },
            totalReach: { $sum: '$reach' },
            totalEngagement: { $sum: '$engagement' },
            avgEngagementRate: { $avg: '$engagementRate' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { influencer: userId, status: 'released' } },
        { $group: { _id: null, total: { $sum: '$influencerPayout' } } },
      ]),
      Payment.aggregate([
        { $match: { influencer: userId, status: 'escrow_held' } },
        { $group: { _id: null, total: { $sum: '$influencerPayout' } } },
      ]),
      Application.countDocuments({ influencer: userId, status: 'accepted' }),
      Conversation.aggregate([
        { $match: { participants: userId } },
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessage',
            foreignField: '_id',
            as: 'lastMsg',
          },
        },
        { $unwind: { path: '$lastMsg', preserveNullAndEmptyArrays: true } },
        { $match: { 'lastMsg.sender': { $ne: userId }, 'lastMsg.readBy': { $not: { $elemMatch: { $eq: userId } } } } },
        { $count: 'count' },
      ]),
      Notification.countDocuments({ user: userId, read: false }),
      Contract.countDocuments({
        $or: [{ influencer: userId }],
        status: { $in: ['pending', 'active'] },
      }),
      Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const metrics = metricsAgg[0] || {};

    return success(res, {
      role: 'influencer',
      stats: {
        activeDeals: acceptedApps,
        totalEarned: totalEarned[0]?.total || 0,
        pendingEarnings: pendingEarnings[0]?.total || 0,
        totalImpressions: metrics.totalImpressions || 0,
        totalReach: metrics.totalReach || 0,
        engagementRate: metrics.avgEngagementRate || 0,
        unreadMessages: unreadMessages[0]?.count || 0,
        unreadNotifications,
        activeContracts,
      },
      recentActivity: recentNotifications.map((n) => ({
        _id: n._id,
        type: n.type,
        title: n.title || n.message,
        time: n.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}
