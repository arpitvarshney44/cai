const FeaturedListing = require('../models/FeaturedListing');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Purchase featured listing (influencer)
// @route   POST /api/v1/featured
exports.purchaseFeaturedListing = async (req, res, next) => {
  try {
    const { durationDays = 30, amount } = req.body;

    if (!amount) {
      return next(new AppError('amount is required', 400));
    }

    // Check if already featured
    const existing = await FeaturedListing.findOne({
      influencer: req.user._id,
      status: 'active',
      endDate: { $gt: new Date() },
    });

    if (existing) {
      return next(new AppError('You already have an active featured listing', 400));
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const listing = await FeaturedListing.create({
      influencer: req.user._id,
      startDate,
      endDate,
      amount,
      currency: 'INR',
      status: 'active',
    });

    return success(res, { listing }, 'Featured listing activated', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get my featured listing status
// @route   GET /api/v1/featured/me
exports.getMyFeaturedStatus = async (req, res, next) => {
  try {
    const listing = await FeaturedListing.findOne({
      influencer: req.user._id,
      status: 'active',
      endDate: { $gt: new Date() },
    }).lean();

    return success(res, { isFeatured: !!listing, listing });
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured influencers (public)
// @route   GET /api/v1/featured
exports.getFeaturedInfluencers = async (req, res, next) => {
  try {
    const listings = await FeaturedListing.find({
      status: 'active',
      endDate: { $gt: new Date() },
    })
      .populate('influencer', 'name email avatar')
      .sort({ position: 1, createdAt: -1 })
      .limit(20)
      .lean();

    return success(res, { featured: listings });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: manage featured listings
// @route   GET /api/v1/featured/admin
exports.adminGetFeaturedListings = async (req, res, next) => {
  try {
    const listings = await FeaturedListing.find()
      .populate('influencer', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    return success(res, { listings });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: cancel featured listing
// @route   PUT /api/v1/featured/:listingId/cancel
exports.adminCancelFeaturedListing = async (req, res, next) => {
  try {
    const listing = await FeaturedListing.findById(req.params.listingId);
    if (!listing) {
      return next(new AppError('Featured listing not found', 404));
    }

    listing.status = 'cancelled';
    await listing.save();

    return success(res, { listing }, 'Featured listing cancelled');
  } catch (error) {
    next(error);
  }
};
