const InfluencerProfile = require('../models/InfluencerProfile');
const { success } = require('../utils/apiResponse');

// @desc    Search & discover influencers with advanced filters
// @route   GET /api/v1/discovery/influencers
exports.discoverInfluencers = async (req, res, next) => {
  try {
    const {
      search,
      niche,
      platform,
      minFollowers,
      maxFollowers,
      minEngagement,
      maxEngagement,
      country,
      city,
      language,
      gender,
      minPrice,
      maxPrice,
      isVerified,
      sortBy = 'relevance',
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Text search on bio
    if (search) {
      filter.$or = [
        { bio: { $regex: search, $options: 'i' } },
      ];
    }

    // Niche filter (comma-separated)
    if (niche) {
      const niches = niche.split(',').map(n => n.trim());
      filter.niche = { $in: niches };
    }

    // Platform filter
    if (platform) {
      const platforms = platform.split(',').map(p => p.trim());
      filter['socialAccounts.platform'] = { $in: platforms };
    }

    // Follower range
    if (minFollowers || maxFollowers) {
      filter.totalFollowers = {};
      if (minFollowers) filter.totalFollowers.$gte = parseInt(minFollowers);
      if (maxFollowers) filter.totalFollowers.$lte = parseInt(maxFollowers);
    }

    // Engagement rate range
    if (minEngagement || maxEngagement) {
      filter.avgEngagementRate = {};
      if (minEngagement) filter.avgEngagementRate.$gte = parseFloat(minEngagement);
      if (maxEngagement) filter.avgEngagementRate.$lte = parseFloat(maxEngagement);
    }

    // Location
    if (country) filter['location.country'] = { $regex: country, $options: 'i' };
    if (city) filter['location.city'] = { $regex: city, $options: 'i' };

    // Language
    if (language) {
      const langs = language.split(',').map(l => l.trim());
      filter.languages = { $in: langs };
    }

    // Gender
    if (gender) filter.gender = gender;

    // Price range (based on pricePerPost)
    if (minPrice || maxPrice) {
      filter.pricePerPost = {};
      if (minPrice) filter.pricePerPost.$gte = parseInt(minPrice);
      if (maxPrice) filter.pricePerPost.$lte = parseInt(maxPrice);
    }

    // Verified only
    if (isVerified === 'true') filter.isVerified = true;

    // Sort options
    const sortOptions = {
      relevance: { isFeatured: -1, aiScore: -1, totalFollowers: -1 },
      followers: { totalFollowers: -1 },
      engagement: { avgEngagementRate: -1 },
      rating: { aiScore: -1 },
      newest: { createdAt: -1 },
      price_low: { pricePerPost: 1 },
      price_high: { pricePerPost: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.relevance;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [influencers, total] = await Promise.all([
      InfluencerProfile.find(filter)
        .populate('user', 'name email avatar')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      InfluencerProfile.countDocuments(filter),
    ]);

    return success(res, {
      influencers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single influencer detail for discovery
// @route   GET /api/v1/discovery/influencers/:profileId
exports.getInfluencerDetail = async (req, res, next) => {
  try {
    const { AppError } = require('../middleware/errorHandler');
    const id = req.params.profileId;

    // Try by profile _id first, fallback to user _id
    let profile = await InfluencerProfile.findById(id).populate('user', 'name email avatar').catch(() => null);
    if (!profile) {
      profile = await InfluencerProfile.findOne({ user: id }).populate('user', 'name email avatar');
    }

    if (!profile) {
      return next(new AppError('Influencer not found', 404));
    }

    return success(res, { profile });
  } catch (error) {
    next(error);
  }
};
