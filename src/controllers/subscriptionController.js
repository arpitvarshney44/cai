const Subscription = require('../models/Subscription');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// Plan definitions
const PLANS = {
  brand: {
    free: { price: 0, maxCampaigns: 3, maxShortlists: 1, advancedAnalytics: false, prioritySupport: false, customBranding: false },
    pro: { price: 2999, maxCampaigns: 20, maxShortlists: 10, advancedAnalytics: true, prioritySupport: true, customBranding: false },
    enterprise: { price: 9999, maxCampaigns: -1, maxShortlists: -1, advancedAnalytics: true, prioritySupport: true, customBranding: true },
  },
  influencer: {
    free: { price: 0, maxApplications: 10, featuredListing: false, advancedAnalytics: false, prioritySupport: false },
    pro: { price: 999, maxApplications: -1, featuredListing: true, advancedAnalytics: true, prioritySupport: true },
  },
};

// @desc    Get available plans for user's role
// @route   GET /api/v1/subscriptions/plans
exports.getPlans = async (req, res, next) => {
  try {
    const role = req.user.role;
    const plans = PLANS[role] || {};
    return success(res, { plans, role });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current subscription
// @route   GET /api/v1/subscriptions/me
exports.getMySubscription = async (req, res, next) => {
  try {
    let subscription = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ['active', 'trialing'] },
    }).lean();

    if (!subscription) {
      // Return default free plan info
      subscription = {
        plan: 'free',
        status: 'active',
        role: req.user.role,
        limits: PLANS[req.user.role]?.free || {},
      };
    }

    return success(res, { subscription });
  } catch (error) {
    next(error);
  }
};

// @desc    Subscribe to a plan
// @route   POST /api/v1/subscriptions
exports.subscribe = async (req, res, next) => {
  try {
    const { plan, interval = 'monthly', razorpayPaymentId } = req.body;
    const role = req.user.role;

    if (!PLANS[role]?.[plan]) {
      return next(new AppError(`Invalid plan '${plan}' for role '${role}'`, 400));
    }

    if (plan === 'free') {
      return next(new AppError('Cannot subscribe to free plan', 400));
    }

    // Check existing active subscription
    const existing = await Subscription.findOne({
      user: req.user._id,
      status: { $in: ['active', 'trialing'] },
    });

    if (existing && existing.plan === plan) {
      return next(new AppError('Already subscribed to this plan', 400));
    }

    // Cancel existing if upgrading
    if (existing) {
      existing.status = 'cancelled';
      existing.cancelledAt = new Date();
      existing.cancelReason = 'Upgraded to new plan';
      await existing.save();
    }

    const planConfig = PLANS[role][plan];
    const multiplier = interval === 'yearly' ? 10 : 1; // yearly = 10 months price
    const price = planConfig.price * multiplier;

    const endDate = new Date();
    if (interval === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const limits = {};
    if (role === 'brand') {
      limits.maxCampaigns = planConfig.maxCampaigns;
      limits.maxShortlists = planConfig.maxShortlists;
      limits.customBranding = planConfig.customBranding;
    } else {
      limits.maxApplications = planConfig.maxApplications;
      limits.featuredListing = planConfig.featuredListing;
    }
    limits.advancedAnalytics = planConfig.advancedAnalytics;
    limits.prioritySupport = planConfig.prioritySupport;

    const subscription = await Subscription.create({
      user: req.user._id,
      plan,
      role,
      status: 'active',
      price,
      currency: 'INR',
      interval,
      startDate: new Date(),
      endDate,
      limits,
      paymentHistory: razorpayPaymentId
        ? [{ amount: price, razorpayPaymentId, status: 'success' }]
        : [],
    });

    return success(res, { subscription }, 'Subscription activated', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel subscription
// @route   PUT /api/v1/subscriptions/cancel
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user._id,
      status: 'active',
    });

    if (!subscription) {
      return next(new AppError('No active subscription found', 404));
    }

    if (subscription.plan === 'free') {
      return next(new AppError('Cannot cancel free plan', 400));
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.cancelReason = req.body.reason || '';
    subscription.autoRenew = false;
    await subscription.save();

    return success(res, { subscription }, 'Subscription cancelled. Access continues until end date.');
  } catch (error) {
    next(error);
  }
};

// @desc    Subscription webhook (Razorpay)
// @route   POST /api/v1/subscriptions/webhook
exports.subscriptionWebhook = async (req, res, next) => {
  try {
    const { event, payload } = req.body;

    if (event === 'subscription.charged') {
      const subId = payload?.subscription?.entity?.id;
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subId });
      if (sub) {
        sub.paymentHistory.push({
          amount: sub.price,
          razorpayPaymentId: payload.payment?.entity?.id,
          status: 'success',
        });
        // Extend end date
        const newEnd = new Date(sub.endDate);
        if (sub.interval === 'yearly') {
          newEnd.setFullYear(newEnd.getFullYear() + 1);
        } else {
          newEnd.setMonth(newEnd.getMonth() + 1);
        }
        sub.endDate = newEnd;
        sub.status = 'active';
        await sub.save();
      }
    } else if (event === 'subscription.cancelled') {
      const subId = payload?.subscription?.entity?.id;
      const sub = await Subscription.findOne({ razorpaySubscriptionId: subId });
      if (sub) {
        sub.status = 'cancelled';
        sub.cancelledAt = new Date();
        await sub.save();
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
};
