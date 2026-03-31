const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Create a new campaign
// @route   POST /api/v1/campaigns
// @access  Brand only
exports.createCampaign = async (req, res, next) => {
  try {
    const {
      title, description, niche, platform, budget,
      deliverables, milestones, timeline, requirements,
      status, coverImage, tags, maxApplications,
    } = req.body;

    const campaign = await Campaign.create({
      brand: req.user._id,
      title,
      description,
      niche: niche || [],
      platform: platform || [],
      budget: budget || {},
      deliverables: deliverables || [],
      milestones: milestones || [],
      timeline: timeline || {},
      requirements: requirements || {},
      status: status || 'draft',
      coverImage,
      tags: tags || [],
      maxApplications: maxApplications || 0,
    });

    return success(res, { campaign }, 'Campaign created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update a campaign
// @route   PUT /api/v1/campaigns/:id
// @access  Brand only (owner)
exports.updateCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return next(new AppError('Campaign not found', 404));
    }

    // Only the brand owner can update
    if (campaign.brand.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized to update this campaign', 403));
    }

    const allowedFields = [
      'title', 'description', 'niche', 'platform', 'budget',
      'deliverables', 'milestones', 'timeline', 'requirements',
      'status', 'coverImage', 'tags', 'maxApplications',
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        campaign[field] = req.body[field];
      }
    });

    // When brand tries to publish (set to active), route to pending for admin approval
    if (req.body.status === 'active' && !campaign.isAdminApproved) {
      campaign.status = 'pending';
    }

    await campaign.save();

    return success(res, { campaign }, 'Campaign updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a campaign
// @route   DELETE /api/v1/campaigns/:id
// @access  Brand only (owner)
exports.deleteCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return next(new AppError('Campaign not found', 404));
    }

    if (campaign.brand.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized to delete this campaign', 403));
    }

    // Only allow delete if draft or cancelled
    if (!['draft', 'cancelled'].includes(campaign.status)) {
      return next(new AppError('Can only delete draft or cancelled campaigns', 400));
    }

    await Campaign.findByIdAndDelete(req.params.id);

    return success(res, null, 'Campaign deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get single campaign
// @route   GET /api/v1/campaigns/:id
// @access  Authenticated
exports.getCampaign = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('brand', 'name email avatar');

    if (!campaign) {
      return next(new AppError('Campaign not found', 404));
    }

    return success(res, { campaign });
  } catch (error) {
    next(error);
  }
};

// @desc    List campaigns (marketplace feed)
// @route   GET /api/v1/campaigns
// @access  Authenticated
// @query   page, limit, niche, platform, minBudget, maxBudget, status, search, sort, location
exports.listCampaigns = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      niche,
      platform,
      minBudget,
      maxBudget,
      status,
      search,
      sort = '-createdAt',
      location,
    } = req.query;

    const filter = {};

    // Only show active, admin-approved campaigns for influencers
    if (req.user.role === 'influencer') {
      filter.status = 'active';
      filter.isAdminApproved = true;
    }

    // For brands, show their own campaigns
    if (req.user.role === 'brand') {
      filter.brand = req.user._id;
      if (status) filter.status = status;
    }

    // Admin can see all, optionally filter by status
    if (req.user.role === 'admin') {
      if (status) filter.status = status;
    }

    // Niche filter
    if (niche) {
      const niches = niche.split(',');
      filter.niche = { $in: niches };
    }

    // Platform filter
    if (platform) {
      const platforms = platform.split(',');
      filter.platform = { $in: platforms };
    }

    // Budget filter
    if (minBudget || maxBudget) {
      filter['budget.max'] = {};
      if (minBudget) filter['budget.max'].$gte = Number(minBudget);
      if (maxBudget) filter['budget.min'] = { $lte: Number(maxBudget) };
    }

    // Location filter
    if (location) {
      filter['requirements.location'] = { $regex: location, $options: 'i' };
    }

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate('brand', 'name email avatar')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Campaign.countDocuments(filter),
    ]);

    return success(res, {
      campaigns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my campaigns (brand)
// @route   GET /api/v1/campaigns/my
// @access  Brand only
exports.getMyCampaigns = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { brand: req.user._id };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Campaign.countDocuments(filter),
    ]);

    return success(res, {
      campaigns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};
