const AffiliateLink = require('../models/AffiliateLink');
const DiscountCode = require('../models/DiscountCode');
const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// ═══════════════════════════════════════
// AFFILIATE LINKS
// ═══════════════════════════════════════

// @desc    Generate affiliate link for a campaign
// @route   POST /api/v1/affiliates/links
exports.createAffiliateLink = async (req, res, next) => {
  try {
    const { campaignId, originalUrl, commissionPercent } = req.body;

    if (!campaignId) {
      return next(new AppError('campaignId is required', 400));
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return next(new AppError('Campaign not found', 404));
    }

    // Check if link already exists
    const existing = await AffiliateLink.findOne({
      influencer: req.user._id,
      campaign: campaignId,
    });
    if (existing) {
      return success(res, { link: existing }, 'Affiliate link already exists');
    }

    const link = await AffiliateLink.create({
      influencer: req.user._id,
      campaign: campaignId,
      originalUrl: originalUrl || '',
      commissionPercent: commissionPercent || 10,
    });

    return success(res, { link }, 'Affiliate link created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get my affiliate links
// @route   GET /api/v1/affiliates/links
exports.getMyAffiliateLinks = async (req, res, next) => {
  try {
    const links = await AffiliateLink.find({ influencer: req.user._id })
      .populate('campaign', 'title status')
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = links.reduce((sum, l) => sum + (l.earnings || 0), 0);
    const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
    const totalConversions = links.reduce((sum, l) => sum + (l.conversions || 0), 0);

    return success(res, { links, totalEarnings, totalClicks, totalConversions });
  } catch (error) {
    next(error);
  }
};

// @desc    Track affiliate click
// @route   GET /api/v1/affiliates/track/:code
exports.trackClick = async (req, res, next) => {
  try {
    const link = await AffiliateLink.findOne({ code: req.params.code, isActive: true });
    if (!link) {
      return next(new AppError('Affiliate link not found or inactive', 404));
    }

    if (link.expiresAt && new Date() > link.expiresAt) {
      return next(new AppError('Affiliate link has expired', 410));
    }

    link.clicks += 1;
    await link.save();

    // Redirect to original URL or return success
    if (link.originalUrl) {
      return res.redirect(link.originalUrl);
    }
    return success(res, { redirectUrl: link.originalUrl, code: link.code }, 'Click tracked');
  } catch (error) {
    next(error);
  }
};

// @desc    Record affiliate conversion
// @route   POST /api/v1/affiliates/convert/:code
exports.recordConversion = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const link = await AffiliateLink.findOne({ code: req.params.code, isActive: true });
    if (!link) {
      return next(new AppError('Affiliate link not found', 404));
    }

    link.conversions += 1;
    if (amount) {
      link.earnings += Math.round(amount * (link.commissionPercent / 100) * 100) / 100;
    }
    await link.save();

    return success(res, { link }, 'Conversion recorded');
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════
// DISCOUNT CODES
// ═══════════════════════════════════════

// @desc    Create discount code (brand)
// @route   POST /api/v1/affiliates/discounts
exports.createDiscountCode = async (req, res, next) => {
  try {
    const { code, campaignId, influencerId, discountPercent, maxUsage, expiresAt, description } = req.body;

    if (!code || !campaignId || !discountPercent) {
      return next(new AppError('code, campaignId, and discountPercent are required', 400));
    }

    const campaign = await Campaign.findOne({ _id: campaignId, brand: req.user._id });
    if (!campaign) {
      return next(new AppError('Campaign not found or not authorized', 404));
    }

    // Check uniqueness
    const existing = await DiscountCode.findOne({ code: code.toUpperCase() });
    if (existing) {
      return next(new AppError('Discount code already exists', 400));
    }

    const discount = await DiscountCode.create({
      code: code.toUpperCase(),
      campaign: campaignId,
      brand: req.user._id,
      influencer: influencerId || null,
      discountPercent,
      maxUsage: maxUsage || 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      description: description || '',
    });

    return success(res, { discount }, 'Discount code created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get discount codes for brand's campaigns
// @route   GET /api/v1/affiliates/discounts
exports.getDiscountCodes = async (req, res, next) => {
  try {
    const { campaignId } = req.query;
    const filter = { brand: req.user._id };
    if (campaignId) filter.campaign = campaignId;

    const discounts = await DiscountCode.find(filter)
      .populate('campaign', 'title')
      .populate('influencer', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return success(res, { discounts });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate and apply discount code
// @route   POST /api/v1/affiliates/discounts/validate
exports.validateDiscountCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) return next(new AppError('code is required', 400));

    const discount = await DiscountCode.findOne({ code: code.toUpperCase(), isActive: true })
      .populate('campaign', 'title');

    if (!discount) {
      return next(new AppError('Invalid or inactive discount code', 404));
    }

    if (discount.expiresAt && new Date() > discount.expiresAt) {
      return next(new AppError('Discount code has expired', 410));
    }

    if (discount.maxUsage > 0 && discount.usageCount >= discount.maxUsage) {
      return next(new AppError('Discount code usage limit reached', 400));
    }

    return success(res, {
      valid: true,
      discountPercent: discount.discountPercent,
      campaign: discount.campaign,
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Revoke (deactivate) a discount code
// @route   PUT /api/v1/affiliates/discounts/:id/revoke
exports.revokeDiscountCode = async (req, res, next) => {
  try {
    const discount = await DiscountCode.findOne({ _id: req.params.id, brand: req.user._id });
    if (!discount) return next(new AppError('Discount code not found', 404));

    discount.isActive = !discount.isActive;
    await discount.save();

    return success(res, { discount }, `Discount code ${discount.isActive ? 'activated' : 'revoked'}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get discount codes assigned to influencer
// @route   GET /api/v1/affiliates/my-codes
exports.getMyAssignedCodes = async (req, res, next) => {
  try {
    const codes = await DiscountCode.find({ influencer: req.user._id, isActive: true })
      .populate('campaign', 'title')
      .populate('brand', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return success(res, { codes });
  } catch (error) {
    next(error);
  }
};


// @desc    Delete a discount code
// @route   DELETE /api/v1/affiliates/discounts/:id
exports.deleteDiscountCode = async (req, res, next) => {
  try {
    const discount = await DiscountCode.findOneAndDelete({ _id: req.params.id, brand: req.user._id });
    if (!discount) return next(new AppError('Discount code not found', 404));
    return success(res, null, 'Discount code deleted');
  } catch (error) {
    next(error);
  }
};
