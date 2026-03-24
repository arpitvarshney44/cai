const InfluencerProfile = require('../models/InfluencerProfile');
const { success } = require('../utils/apiResponse');

// @desc    Get platform-wide influencer analytics for admin
// @route   GET /api/v1/admin/discovery/analytics
exports.getDiscoveryAnalytics = async (req, res, next) => {
  try {
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
      InfluencerProfile.countDocuments({ isVerified: true }),
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
        .populate('user', 'name email avatar')
        .sort({ totalFollowers: -1 })
        .limit(10)
        .lean(),
      InfluencerProfile.find({ avgEngagementRate: { $gt: 0 } })
        .populate('user', 'name email avatar')
        .sort({ avgEngagementRate: -1 })
        .limit(10)
        .lean(),
      InfluencerProfile.find({ aiScore: { $gt: 0 } })
        .populate('user', 'name email avatar')
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
