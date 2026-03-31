const InfluencerProfile = require('../models/InfluencerProfile');
const User = require('../models/User');
const { success } = require('../utils/apiResponse');

// @desc    Get platform-wide influencer analytics for admin
// @route   GET /api/v1/admin/discovery/analytics
exports.getDiscoveryAnalytics = async (req, res, next) => {
  try {
    // Get all influencer user IDs
    const allProfiles = await InfluencerProfile.find().select('user').lean();
    const influencerUserIds = allProfiles.map(p => p.user);

    const [
      totalInfluencers,
      verifiedCount,
      nicheDistribution,
      platformDistribution,
      topByFollowers,
      topByEngagement,
      topByAiScore,
    ] = await Promise.all([
      InfluencerProfile.countDocuments(),
      // Count users who are email-verified (matches Users page)
      User.countDocuments({ _id: { $in: influencerUserIds }, isVerified: true }),
      InfluencerProfile.aggregate([
        { $unwind: '$niche' },
        { $group: { _id: '$niche', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      InfluencerProfile.aggregate([
        { $unwind: '$socialAccounts' },
        { $group: { _id: '$socialAccounts.platform', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      InfluencerProfile.find()
        .populate('user', 'name email avatar isVerified')
        .sort({ totalFollowers: -1 })
        .limit(10)
        .lean(),
      InfluencerProfile.find({ avgEngagementRate: { $gt: 0 } })
        .populate('user', 'name email avatar isVerified')
        .sort({ avgEngagementRate: -1 })
        .limit(10)
        .lean(),
      InfluencerProfile.find({ aiScore: { $gt: 0 } })
        .populate('user', 'name email avatar isVerified')
        .sort({ aiScore: -1 })
        .limit(10)
        .lean(),
    ]);

    return success(res, {
      overview: {
        totalInfluencers,
        verifiedCount,
        unverifiedCount: totalInfluencers - verifiedCount,
      },
      nicheDistribution,
      platformDistribution,
      topByFollowers,
      topByEngagement,
      topByAiScore,
    });
  } catch (error) {
    next(error);
  }
};
