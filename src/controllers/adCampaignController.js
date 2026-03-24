const AdCampaign = require('../models/AdCampaign');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Create ad campaign
// @route   POST /api/v1/ads
exports.createAdCampaign = async (req, res, next) => {
  try {
    const { title, description, budget, targeting, creatives, startDate, endDate } = req.body;

    if (!title || !budget?.total || !startDate || !endDate) {
      return next(new AppError('title, budget.total, startDate, and endDate are required', 400));
    }

    const ad = await AdCampaign.create({
      brand: req.user._id,
      title,
      description: description || '',
      budget: { total: budget.total, daily: budget.daily || 0, spent: 0, currency: budget.currency || 'INR' },
      targeting: targeting || {},
      creatives: creatives || [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'draft',
    });

    return success(res, { ad }, 'Ad campaign created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get my ad campaigns
// @route   GET /api/v1/ads
exports.getMyAdCampaigns = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { brand: req.user._id };
    if (status) filter.status = status;

    const [ads, total] = await Promise.all([
      AdCampaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      AdCampaign.countDocuments(filter),
    ]);

    return success(res, {
      ads,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single ad campaign
// @route   GET /api/v1/ads/:adId
exports.getAdCampaign = async (req, res, next) => {
  try {
    const ad = await AdCampaign.findOne({ _id: req.params.adId, brand: req.user._id });
    if (!ad) return next(new AppError('Ad campaign not found', 404));
    return success(res, { ad });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ad campaign
// @route   PUT /api/v1/ads/:adId
exports.updateAdCampaign = async (req, res, next) => {
  try {
    const ad = await AdCampaign.findOne({
      _id: req.params.adId,
      brand: req.user._id,
      status: { $in: ['draft', 'paused'] },
    });
    if (!ad) return next(new AppError('Ad campaign not found or cannot be edited', 404));

    const { title, description, budget, targeting, creatives, startDate, endDate } = req.body;
    if (title) ad.title = title;
    if (description !== undefined) ad.description = description;
    if (budget) {
      if (budget.total) ad.budget.total = budget.total;
      if (budget.daily !== undefined) ad.budget.daily = budget.daily;
    }
    if (targeting) ad.targeting = { ...ad.targeting, ...targeting };
    if (creatives) ad.creatives = creatives;
    if (startDate) ad.startDate = new Date(startDate);
    if (endDate) ad.endDate = new Date(endDate);

    await ad.save();
    return success(res, { ad }, 'Ad campaign updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Change ad campaign status (activate/pause/stop)
// @route   PUT /api/v1/ads/:adId/status
exports.changeAdStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validTransitions = {
      draft: ['active', 'cancelled'],
      active: ['paused', 'cancelled'],
      paused: ['active', 'cancelled'],
    };

    const ad = await AdCampaign.findOne({ _id: req.params.adId, brand: req.user._id });
    if (!ad) return next(new AppError('Ad campaign not found', 404));

    const allowed = validTransitions[ad.status];
    if (!allowed || !allowed.includes(status)) {
      return next(new AppError(`Cannot transition from '${ad.status}' to '${status}'`, 400));
    }

    ad.status = status;
    await ad.save();

    return success(res, { ad }, `Ad campaign ${status}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get ad campaign performance
// @route   GET /api/v1/ads/:adId/performance
exports.getAdPerformance = async (req, res, next) => {
  try {
    const ad = await AdCampaign.findOne({ _id: req.params.adId, brand: req.user._id }).lean();
    if (!ad) return next(new AppError('Ad campaign not found', 404));

    const budgetUtilization = ad.budget.total > 0 ? (ad.budget.spent / ad.budget.total) * 100 : 0;
    const daysTotal = Math.ceil((new Date(ad.endDate) - new Date(ad.startDate)) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((Date.now() - new Date(ad.startDate)) / (1000 * 60 * 60 * 24));

    return success(res, {
      ad,
      performance: {
        ...ad.metrics,
        budgetUtilization: Math.min(budgetUtilization, 100),
        daysTotal,
        daysElapsed: Math.min(daysElapsed, daysTotal),
        daysRemaining: Math.max(daysTotal - daysElapsed, 0),
        dailyAvgSpend: daysElapsed > 0 ? ad.budget.spent / daysElapsed : 0,
      },
      dailyMetrics: ad.dailyMetrics || [],
    });
  } catch (error) {
    next(error);
  }
};
