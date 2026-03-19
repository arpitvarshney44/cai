const Application = require('../models/Application');
const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Apply to a campaign
// @route   POST /api/v1/applications
// @access  Influencer only
exports.applyToCampaign = async (req, res, next) => {
  try {
    const { campaignId, pitch } = req.body;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return next(new AppError('Campaign not found', 404));
    if (campaign.status !== 'active') return next(new AppError('Campaign is not accepting applications', 400));

    // Check max applications limit
    if (campaign.maxApplications > 0 && campaign.applicationsCount >= campaign.maxApplications) {
      return next(new AppError('Campaign has reached maximum applications', 400));
    }

    // Check duplicate
    const existing = await Application.findOne({ campaign: campaignId, influencer: req.user._id });
    if (existing) {
      if (existing.status === 'withdrawn') {
        // Allow re-application
        existing.pitch = pitch;
        existing.status = 'pending';
        existing.respondedAt = undefined;
        existing.brandNote = undefined;
        await existing.save();
        return success(res, { application: existing }, 'Application re-submitted', 200);
      }
      return next(new AppError('You have already applied to this campaign', 400));
    }

    const application = await Application.create({
      campaign: campaignId,
      influencer: req.user._id,
      pitch,
    });

    // Increment applications count
    await Campaign.findByIdAndUpdate(campaignId, { $inc: { applicationsCount: 1 } });

    return success(res, { application }, 'Application submitted successfully', 201);
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('You have already applied to this campaign', 400));
    }
    next(error);
  }
};

// @desc    List applications for a campaign (brand view)
// @route   GET /api/v1/applications/campaign/:campaignId
// @access  Brand (campaign owner)
exports.getCampaignApplications = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    // Verify campaign ownership
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return next(new AppError('Campaign not found', 404));
    if (campaign.brand.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }

    const filter = { campaign: campaignId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('influencer', 'name email avatar')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Application.countDocuments(filter),
    ]);

    return success(res, {
      applications,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List my applications (influencer view)
// @route   GET /api/v1/applications/my
// @access  Influencer only
exports.getMyApplications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { influencer: req.user._id };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate({
          path: 'campaign',
          select: 'title description budget platform niche status brand',
          populate: { path: 'brand', select: 'name avatar' },
        })
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Application.countDocuments(filter),
    ]);

    return success(res, {
      applications,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept/reject an application
// @route   PUT /api/v1/applications/:id/respond
// @access  Brand (campaign owner)
exports.respondToApplication = async (req, res, next) => {
  try {
    const { status, brandNote } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return next(new AppError('Status must be accepted or rejected', 400));
    }

    const application = await Application.findById(req.params.id).populate('campaign');
    if (!application) return next(new AppError('Application not found', 404));

    if (application.campaign.brand.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }

    if (application.status !== 'pending') {
      return next(new AppError('Can only respond to pending applications', 400));
    }

    application.status = status;
    application.brandNote = brandNote || undefined;
    application.respondedAt = new Date();
    await application.save();

    // If accepted, optionally move campaign to in_progress
    if (status === 'accepted') {
      const campaign = await Campaign.findById(application.campaign._id);
      if (campaign && campaign.status === 'active') {
        campaign.status = 'in_progress';
        await campaign.save();
      }
    }

    return success(res, { application }, `Application ${status}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Withdraw an application
// @route   PUT /api/v1/applications/:id/withdraw
// @access  Influencer (applicant)
exports.withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return next(new AppError('Application not found', 404));

    if (application.influencer.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }

    if (application.status !== 'pending') {
      return next(new AppError('Can only withdraw pending applications', 400));
    }

    application.status = 'withdrawn';
    await application.save();

    await Campaign.findByIdAndUpdate(application.campaign, { $inc: { applicationsCount: -1 } });

    return success(res, { application }, 'Application withdrawn');
  } catch (error) {
    next(error);
  }
};
