const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Application = require('../models/Application');
const { success } = require('../utils/apiResponse');

// @desc    Get comprehensive admin analytics
// @route   GET /api/v1/admin/analytics/overview
exports.getAnalyticsOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // ── User Analytics ──
    const [totalUsers, totalBrands, totalInfluencers] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'brand' }),
      User.countDocuments({ role: 'influencer' }),
    ]);

    // Signups trend (last 30 days)
    const signupTrend = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, role: { $ne: 'admin' } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          brands: { $sum: { $cond: [{ $eq: ['$role', 'brand'] }, 1, 0] } },
          influencers: { $sum: { $cond: [{ $eq: ['$role', 'influencer'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // DAU approximation (users who logged in last 24h)
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const dau = await User.countDocuments({ lastLogin: { $gte: oneDayAgo }, role: { $ne: 'admin' } });
    const wau = await User.countDocuments({ lastLogin: { $gte: sevenDaysAgo }, role: { $ne: 'admin' } });
    const mau = await User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo }, role: { $ne: 'admin' } });

    // Retention: users who signed up 30-60 days ago and logged in last 30 days
    const cohortUsers = await User.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      role: { $ne: 'admin' },
    });
    const retainedUsers = await User.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      lastLogin: { $gte: thirtyDaysAgo },
      role: { $ne: 'admin' },
    });
    const retentionRate = cohortUsers > 0 ? Math.round((retainedUsers / cohortUsers) * 100) : 0;

    // ── Campaign Analytics ──
    const [totalCampaigns, activeCampaigns, completedCampaigns, cancelledCampaigns] = await Promise.all([
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: 'active' }),
      Campaign.countDocuments({ status: 'completed' }),
      Campaign.countDocuments({ status: 'cancelled' }),
    ]);

    const campaignSuccessRate = totalCampaigns > 0
      ? Math.round((completedCampaigns / totalCampaigns) * 100)
      : 0;

    const campaignTrend = await Campaign.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Niche distribution
    const nicheDistribution = await Campaign.aggregate([
      { $unwind: '$niche' },
      { $group: { _id: '$niche', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Platform distribution
    const platformDistribution = await Campaign.aggregate([
      { $unwind: '$platform' },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // ── Revenue Analytics ──
    const totalRevenue = await Payment.aggregate([
      { $match: { status: { $in: ['escrow_held', 'released'] } } },
      { $group: { _id: null, total: { $sum: '$amount' }, fees: { $sum: '$platformFee' } } },
    ]);

    const revenueTrend = await Payment.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $in: ['escrow_held', 'released'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          fees: { $sum: '$platformFee' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Subscription analytics
    const [activeSubscriptions, proSubscriptions, enterpriseSubscriptions] = await Promise.all([
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'active', plan: 'pro' }),
      Subscription.countDocuments({ status: 'active', plan: 'enterprise' }),
    ]);

    const subscriptionRevenue = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$plan', count: { $sum: 1 }, revenue: { $sum: '$price' } } },
    ]);

    // ── Application Analytics ──
    const totalApplications = await Application.countDocuments();
    const applicationStatusDist = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return success(res, {
      users: {
        total: totalUsers,
        brands: totalBrands,
        influencers: totalInfluencers,
        dau,
        wau,
        mau,
        retentionRate,
        signupTrend,
      },
      campaigns: {
        total: totalCampaigns,
        active: activeCampaigns,
        completed: completedCampaigns,
        cancelled: cancelledCampaigns,
        successRate: campaignSuccessRate,
        trend: campaignTrend,
        nicheDistribution,
        platformDistribution,
      },
      revenue: {
        totalRevenue: totalRevenue[0]?.total || 0,
        totalFees: totalRevenue[0]?.fees || 0,
        trend: revenueTrend,
        subscriptions: {
          active: activeSubscriptions,
          pro: proSubscriptions,
          enterprise: enterpriseSubscriptions,
          byPlan: subscriptionRevenue,
        },
      },
      applications: {
        total: totalApplications,
        statusDistribution: applicationStatusDist,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Export analytics report as CSV
// @route   GET /api/v1/admin/analytics/export
exports.exportAnalytics = async (req, res, next) => {
  try {
    const { type = 'users' } = req.query;

    let csvData = '';

    if (type === 'users') {
      const users = await User.find({ role: { $ne: 'admin' } })
        .select('name email role isVerified isBlocked createdAt lastLogin')
        .sort({ createdAt: -1 })
        .limit(5000);

      csvData = 'Name,Email,Role,Verified,Blocked,Joined,Last Login\n';
      csvData += users.map(u =>
        `"${u.name}","${u.email}","${u.role}",${u.isVerified},${u.isBlocked},"${u.createdAt.toISOString()}","${u.lastLogin?.toISOString() || 'Never'}"`
      ).join('\n');
    } else if (type === 'campaigns') {
      const campaigns = await Campaign.find()
        .populate('brand', 'name email')
        .select('title status niche platform budget createdAt')
        .sort({ createdAt: -1 })
        .limit(5000);

      csvData = 'Title,Brand,Status,Niche,Platform,Budget Min,Budget Max,Created\n';
      csvData += campaigns.map(c =>
        `"${c.title}","${c.brand?.name || 'N/A'}","${c.status}","${c.niche?.join(', ')}","${c.platform?.join(', ')}",${c.budget?.min || 0},${c.budget?.max || 0},"${c.createdAt.toISOString()}"`
      ).join('\n');
    } else if (type === 'revenue') {
      const payments = await Payment.find({ status: { $in: ['escrow_held', 'released'] } })
        .populate('brand', 'name')
        .populate('influencer', 'name')
        .select('amount platformFee status type createdAt')
        .sort({ createdAt: -1 })
        .limit(5000);

      csvData = 'Amount,Platform Fee,Status,Type,Brand,Influencer,Date\n';
      csvData += payments.map(p =>
        `${p.amount},${p.platformFee},"${p.status}","${p.type}","${p.brand?.name || 'N/A'}","${p.influencer?.name || 'N/A'}","${p.createdAt.toISOString()}"`
      ).join('\n');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${Date.now()}.csv`);
    return res.send(csvData);
  } catch (err) {
    next(err);
  }
};
