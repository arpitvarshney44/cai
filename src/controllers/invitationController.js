const Invitation = require('../models/Invitation');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Send invitation to influencer
// @route   POST /api/v1/invitations
// @access  Brand only
exports.sendInvitation = async (req, res, next) => {
  try {
    const { campaignId, influencerId, influencerProfileId, message } = req.body;

    // Validate campaign ownership
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return next(new AppError('Campaign not found', 404));
    if (campaign.brand.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized — you do not own this campaign', 403));
    }
    if (!['active', 'in_progress'].includes(campaign.status)) {
      return next(new AppError('Campaign must be active to send invitations', 400));
    }

    // Resolve influencer user ID — accept either userId or profileId
    let resolvedInfluencerId = influencerId;
    if (!resolvedInfluencerId && influencerProfileId) {
      const InfluencerProfile = require('../models/InfluencerProfile');
      const profile = await InfluencerProfile.findById(influencerProfileId).select('user').lean();
      if (!profile) return next(new AppError('Influencer not found', 404));
      resolvedInfluencerId = profile.user.toString();
    }

    if (!resolvedInfluencerId) return next(new AppError('influencerId or influencerProfileId is required', 400));

    // Validate influencer exists
    const influencer = await User.findById(resolvedInfluencerId);
    if (!influencer || influencer.role !== 'influencer') {
      return next(new AppError('Influencer not found', 404));
    }

    // Check duplicate
    const existing = await Invitation.findOne({ campaign: campaignId, influencer: resolvedInfluencerId });
    if (existing) {
      return next(new AppError('Invitation already sent to this influencer for this campaign', 400));
    }

    const invitation = await Invitation.create({
      campaign: campaignId,
      brand: req.user._id,
      influencer: resolvedInfluencerId,
      message: message || '',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    return success(res, { invitation }, 'Invitation sent successfully', 201);
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('Invitation already sent', 400));
    }
    next(error);
  }
};

// @desc    Respond to an invitation (accept/reject)
// @route   PUT /api/v1/invitations/:id/respond
// @access  Influencer only
exports.respondToInvitation = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return next(new AppError('Status must be accepted or rejected', 400));
    }

    const invitation = await Invitation.findById(req.params.id);
    if (!invitation) return next(new AppError('Invitation not found', 404));

    if (invitation.influencer.toString() !== req.user._id.toString()) {
      return next(new AppError('Not authorized', 403));
    }

    if (invitation.status !== 'pending') {
      return next(new AppError('Can only respond to pending invitations', 400));
    }

    // Check expiry
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      invitation.status = 'expired';
      await invitation.save();
      return next(new AppError('This invitation has expired', 400));
    }

    invitation.status = status;
    invitation.respondedAt = new Date();
    await invitation.save();

    return success(res, { invitation }, `Invitation ${status}`);
  } catch (error) {
    next(error);
  }
};

// @desc    List invitations received by influencer
// @route   GET /api/v1/invitations/received
// @access  Influencer only
exports.getReceivedInvitations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { influencer: req.user._id };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [invitations, total] = await Promise.all([
      Invitation.find(filter)
        .populate('brand', 'name email avatar')
        .populate({
          path: 'campaign',
          select: 'title description budget platform niche status',
        })
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Invitation.countDocuments(filter),
    ]);

    return success(res, {
      invitations,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List invitations sent by brand
// @route   GET /api/v1/invitations/sent
// @access  Brand only
exports.getSentInvitations = async (req, res, next) => {
  try {
    const { campaignId, status, page = 1, limit = 20 } = req.query;

    const filter = { brand: req.user._id };
    if (campaignId) filter.campaign = campaignId;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [invitations, total] = await Promise.all([
      Invitation.find(filter)
        .populate('influencer', 'name email avatar')
        .populate({
          path: 'campaign',
          select: 'title status',
        })
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Invitation.countDocuments(filter),
    ]);

    return success(res, {
      invitations,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};
