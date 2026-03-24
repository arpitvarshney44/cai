const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const FeaturedListing = require('../models/FeaturedListing');
const { success } = require('../utils/apiResponse');

// @desc    Admin: Get payment & revenue dashboard
// @route   GET /api/v1/admin/payments/dashboard
exports.getPaymentDashboard = async (req, res, next) => {
  try {
    const [
      totalRevenue,
      totalEscrow,
      totalReleased,
      totalRefunded,
      totalPlatformFees,
      paymentsByStatus,
      monthlyRevenue,
      activeSubscriptions,
      totalSubscriptionRevenue,
      activeFeatured,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { status: { $in: ['escrow_held', 'released'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'escrow_held' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'released' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: { $in: ['refunded', 'partially_refunded'] } } },
        { $group: { _id: null, total: { $sum: '$refundAmount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: { $in: ['escrow_held', 'released'] } } },
        { $group: { _id: null, total: { $sum: '$platformFee' } } },
      ]),
      Payment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: { $in: ['escrow_held', 'released'] } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            total: { $sum: '$amount' },
            fees: { $sum: '$platformFee' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ]),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]),
      FeaturedListing.countDocuments({ status: 'active', endDate: { $gt: new Date() } }),
    ]);

    return success(res, {
      overview: {
        totalRevenue: totalRevenue[0]?.total || 0,
        escrowHeld: totalEscrow[0]?.total || 0,
        released: totalReleased[0]?.total || 0,
        refunded: totalRefunded[0]?.total || 0,
        platformFees: totalPlatformFees[0]?.total || 0,
        activeSubscriptions,
        subscriptionRevenue: totalSubscriptionRevenue[0]?.total || 0,
        activeFeaturedListings: activeFeatured,
      },
      paymentsByStatus,
      monthlyRevenue: monthlyRevenue.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get all transactions
// @route   GET /api/v1/admin/payments/transactions
exports.getAllTransactions = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 30 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('campaign', 'title')
        .populate('brand', 'name email')
        .populate('influencer', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments(filter),
    ]);

    return success(res, {
      payments,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get subscription analytics
// @route   GET /api/v1/admin/payments/subscriptions
exports.getSubscriptionAnalytics = async (req, res, next) => {
  try {
    const [byPlan, byStatus, recentSubs] = await Promise.all([
      Subscription.aggregate([
        { $group: { _id: { plan: '$plan', role: '$role' }, count: { $sum: 1 }, revenue: { $sum: '$price' } } },
      ]),
      Subscription.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Subscription.find()
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return success(res, { byPlan, byStatus, recentSubscriptions: recentSubs });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Commission report
// @route   GET /api/v1/admin/payments/commissions
exports.getCommissionReport = async (req, res, next) => {
  try {
    const [totalCommissions, monthlyCommissions, topCampaigns] = await Promise.all([
      Payment.aggregate([
        { $match: { status: { $in: ['escrow_held', 'released'] } } },
        { $group: { _id: null, total: { $sum: '$platformFee' }, count: { $sum: 1 }, avgFee: { $avg: '$platformFeePercent' } } },
      ]),
      Payment.aggregate([
        { $match: { status: { $in: ['escrow_held', 'released'] } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            commission: { $sum: '$platformFee' },
            volume: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
      ]),
      Payment.aggregate([
        { $match: { status: { $in: ['escrow_held', 'released'] } } },
        { $group: { _id: '$campaign', totalAmount: { $sum: '$amount' }, totalFee: { $sum: '$platformFee' }, count: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'campaigns', localField: '_id', foreignField: '_id', as: 'campaignInfo',
          },
        },
        { $unwind: { path: '$campaignInfo', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    return success(res, {
      total: totalCommissions[0] || { total: 0, count: 0, avgFee: 10 },
      monthly: monthlyCommissions.reverse(),
      topCampaigns,
    });
  } catch (error) {
    next(error);
  }
};
