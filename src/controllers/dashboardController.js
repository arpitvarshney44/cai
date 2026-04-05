const Campaign = require('../models/Campaign');
const CampaignMetrics = require('../models/CampaignMetrics');
const Payment = require('../models/Payment');
const Application = require('../models/Application');
const Contract = require('../models/Contract');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const User = require('../models/User');
const BrandProfile = require('../models/BrandProfile');
const InfluencerProfile = require('../models/InfluencerProfile');
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

    // --- Top Influencers with fallback ---
    let topInfluencers = await InfluencerProfile.find({ totalEarnings: { $gt: 0 } })
      .populate('user', 'name')
      .sort({ totalEarnings: -1 })
      .limit(6)
      .lean();

    if (!topInfluencers.length) {
      topInfluencers = await InfluencerProfile.find()
        .populate('user', 'name')
        .sort({ totalFollowers: -1 })
        .limit(6)
        .lean();
    }

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
      topInfluencers: topInfluencers.map(i => ({
        _id: i._id,
        name: i.user?.name || 'Anonymous',
        earnings: i.totalEarnings || 0,
        avatar: i.profileImage,
        followers: i.totalFollowers || 0,
        niche: i.niche?.[0]
      })),
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

    // --- Top Campaigns with fallback ---
    let topCampaigns = await Campaign.find({ isAdminApproved: true, status: 'active' })
      .populate('brand', 'name avatar')
      .sort({ applicationsCount: -1 })
      .limit(6)
      .lean();

    if (!topCampaigns.length) {
      topCampaigns = await Campaign.find({ status: 'active' })
        .populate('brand', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();
    }

    // Map topCampaigns to include brand logo and name properly
    topCampaigns = await Promise.all(topCampaigns.map(async (c) => {
      const bp = await BrandProfile.findOne({ user: c.brand?._id || c.brand })
        .select('logo companyName')
        .lean();
      
      const bLogo = bp?.logo || c.brand?.avatar;
      const bName = bp?.companyName || c.brand?.name || c.brandName || 'ConnectAI Brand';
      
      return {
        ...c,
        brandName: bName,
        brandLogo: bLogo,
      };
    }));

    // --- Top Brands with fallback ---
    const topBrandsAgg = await Payment.aggregate([
      { $match: { status: { $in: ['escrow_held', 'released'] } } },
      { $group: { _id: '$brand', totalSpend: { $sum: '$amount' } } },
      { $sort: { totalSpend: -1 } },
      { $limit: 6 },
    ]);

    let topBrands = [];
    if (topBrandsAgg.length) {
      topBrands = await Promise.all(topBrandsAgg.map(async (b) => {
        const u = await User.findById(b._id).select('name avatar').lean();
        const p = await BrandProfile.findOne({ user: b._id }).select('logo companyName').lean();
        return {
          _id: b._id,
          name: p?.companyName || u?.name || 'Top Brand',
          totalSpend: b.totalSpend,
          logo: p?.logo || u?.avatar
        };
      }));
    } else {
      const brandProfiles = await BrandProfile.find()
        .populate('user', 'name avatar')
        .limit(6)
        .lean();
      
      topBrands = brandProfiles.map(p => ({
        _id: p.user?._id,
        name: p.companyName || p.user?.name || 'Partner Brand',
        totalSpend: 0,
        logo: p.logo || p.user?.avatar
      }));
    }

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
      topCampaigns: topCampaigns.map(c => ({
        _id: c._id,
        title: c.title,
        budget: c.budget,
        applications: c.applicationsCount,
        image: c.coverImage,
        niche: c.niche?.[0],
        brandName: c.brandName,
        brandLogo: c.brandLogo
      })),
      topBrands,
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
