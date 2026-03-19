const DeliverableSubmission = require('../models/DeliverableSubmission');
const Campaign = require('../models/Campaign');
const Application = require('../models/Application');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Submit a deliverable
// @route   POST /api/v1/deliverables
// @access  Influencer only (accepted applicant)
exports.submitDeliverable = async (req, res, next) => {
  try {
    const { campaignId, deliverableType, contentLink, description } = req.body;

    // Verify campaign exists
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    // Verify influencer is accepted for this campaign
    const application = await Application.findOne({
      campaign: campaignId,
      influencer: req.user._id,
      status: 'accepted',
    });
    if (!application) {
      return next(new AppError('You must be an accepted applicant to submit deliverables', 403));
    }

    const submission = await DeliverableSubmission.create({
      campaign: campaignId,
      influencer: req.user._id,
      deliverableType,
      contentLink,
      description: description || '',
    });

    return success(res, { submission }, 'Deliverable submitted', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Review a deliverable (approve / request revision)
// @route   PUT /api/v1/deliverables/:id/review
// @access  Brand only (campaign owner)
exports.reviewDeliverable = async (req, res, next) => {
  try {
    const { status, brandFeedback } = req.body;

    if (!['approved', 'revision_needed', 'rejected'].includes(status)) {
      return next(new AppError('Status must be approved, revision_needed, or rejected', 400));
    }

    const submission = await DeliverableSubmission.findById(req.params.id);
    if (!submission) return next(new AppError('Submission not found', 404));

    // Verify campaign ownership
    const campaign = await Campaign.findById(submission.campaign);
    if (!campaign || campaign.brand.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }

    submission.status = status;
    submission.brandFeedback = brandFeedback || undefined;
    submission.reviewedAt = new Date();
    await submission.save();

    return success(res, { submission }, `Deliverable ${status.replace('_', ' ')}`);
  } catch (error) {
    next(error);
  }
};

// @desc    List deliverables for a campaign
// @route   GET /api/v1/deliverables/campaign/:campaignId
// @access  Brand (owner) or Influencer (accepted)
exports.getCampaignDeliverables = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { status, influencer } = req.query;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    // Auth check: brand owner or accepted influencer
    if (req.user.role === 'brand' && campaign.brand.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }
    if (req.user.role === 'influencer') {
      const app = await Application.findOne({ campaign: campaignId, influencer: req.user._id, status: 'accepted' });
      if (!app) return next(new AppError('Not authorized', 403));
    }

    const filter = { campaign: campaignId };
    if (status) filter.status = status;
    if (influencer && req.user.role === 'brand') filter.influencer = influencer;
    if (req.user.role === 'influencer') filter.influencer = req.user._id;

    const submissions = await DeliverableSubmission.find(filter)
      .populate('influencer', 'name email avatar')
      .sort('-createdAt');

    return success(res, { submissions });
  } catch (error) {
    next(error);
  }
};

// @desc    List my deliverable submissions
// @route   GET /api/v1/deliverables/my
// @access  Influencer only
exports.getMyDeliverables = async (req, res, next) => {
  try {
    const { campaignId, status } = req.query;

    const filter = { influencer: req.user._id };
    if (campaignId) filter.campaign = campaignId;
    if (status) filter.status = status;

    const submissions = await DeliverableSubmission.find(filter)
      .populate({
        path: 'campaign',
        select: 'title brand status',
        populate: { path: 'brand', select: 'name' },
      })
      .sort('-createdAt');

    return success(res, { submissions });
  } catch (error) {
    next(error);
  }
};
