const Contract = require('../models/Contract');
const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Create a new contract (brand only)
// @route   POST /api/v1/contracts
exports.createContract = async (req, res, next) => {
  try {
    const {
      campaignId, influencerId, title, terms, deliverables,
      compensation, timeline, exclusivity, usageRights,
      cancellationPolicy, notes,
    } = req.body;

    if (!campaignId || !influencerId || !title || !terms || !compensation?.amount || !timeline?.startDate || !timeline?.endDate) {
      return next(new AppError('Missing required fields: campaignId, influencerId, title, terms, compensation.amount, timeline.startDate, timeline.endDate', 400));
    }

    // Verify campaign belongs to this brand
    const campaign = await Campaign.findOne({ _id: campaignId, brand: req.user._id });
    if (!campaign) {
      return next(new AppError('Campaign not found or not authorized', 404));
    }

    // Check if contract already exists for this campaign-influencer pair
    const existing = await Contract.findOne({
      campaign: campaignId,
      influencer: influencerId,
      status: { $nin: ['cancelled'] },
    });
    if (existing) {
      return next(new AppError('A contract already exists for this campaign and influencer', 400));
    }

    const contract = await Contract.create({
      campaign: campaignId,
      brand: req.user._id,
      influencer: influencerId,
      title,
      terms,
      deliverables: deliverables || [],
      compensation: {
        amount: compensation.amount,
        currency: compensation.currency || 'USD',
        paymentTerms: compensation.paymentTerms || 'Upon completion',
      },
      timeline: {
        startDate: new Date(timeline.startDate),
        endDate: new Date(timeline.endDate),
      },
      exclusivity: exclusivity || false,
      usageRights: usageRights || '',
      cancellationPolicy: cancellationPolicy || '',
      notes: notes || '',
      status: 'pending_influencer',
      brandSignature: {
        signed: true,
        signedAt: new Date(),
        ipAddress: req.ip,
      },
    });

    const populated = await Contract.findById(contract._id)
      .populate('campaign', 'title')
      .populate('brand', 'name email avatar')
      .populate('influencer', 'name email avatar');

    // Emit notification via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${influencerId}`).emit('newContract', {
        contractId: contract._id,
        campaignTitle: campaign.title,
        brandName: req.user.name,
      });
    }

    return success(res, { contract: populated }, 'Contract created and sent to influencer', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get contracts for current user (brand or influencer)
// @route   GET /api/v1/contracts
exports.getMyContracts = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      $or: [{ brand: req.user._id }, { influencer: req.user._id }],
    };
    if (status) filter.status = status;

    const [contracts, total] = await Promise.all([
      Contract.find(filter)
        .populate('campaign', 'title status')
        .populate('brand', 'name email avatar')
        .populate('influencer', 'name email avatar')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Contract.countDocuments(filter),
    ]);

    return success(res, {
      contracts,
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

// @desc    Get single contract detail
// @route   GET /api/v1/contracts/:contractId
exports.getContract = async (req, res, next) => {
  try {
    const contract = await Contract.findOne({
      _id: req.params.contractId,
      $or: [{ brand: req.user._id }, { influencer: req.user._id }],
    })
      .populate('campaign', 'title description status')
      .populate('brand', 'name email avatar')
      .populate('influencer', 'name email avatar')
      .populate('revisions.revisedBy', 'name');

    if (!contract) {
      return next(new AppError('Contract not found', 404));
    }

    return success(res, { contract });
  } catch (error) {
    next(error);
  }
};

// @desc    Sign a contract (influencer signs pending_influencer, brand signs pending_brand)
// @route   PUT /api/v1/contracts/:contractId/sign
exports.signContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.contractId);
    if (!contract) {
      return next(new AppError('Contract not found', 404));
    }

    const userId = req.user._id.toString();
    const isBrand = contract.brand.toString() === userId;
    const isInfluencer = contract.influencer.toString() === userId;

    if (!isBrand && !isInfluencer) {
      return next(new AppError('Not authorized to sign this contract', 403));
    }

    // Influencer signing
    if (isInfluencer && contract.status === 'pending_influencer') {
      contract.influencerSignature = {
        signed: true,
        signedAt: new Date(),
        ipAddress: req.ip,
      };
      // If brand already signed, contract becomes active
      if (contract.brandSignature.signed) {
        contract.status = 'active';
      } else {
        contract.status = 'pending_brand';
      }
    }
    // Brand signing (if contract was revised and needs brand re-sign)
    else if (isBrand && contract.status === 'pending_brand') {
      contract.brandSignature = {
        signed: true,
        signedAt: new Date(),
        ipAddress: req.ip,
      };
      if (contract.influencerSignature.signed) {
        contract.status = 'active';
      } else {
        contract.status = 'pending_influencer';
      }
    } else {
      return next(new AppError(`Cannot sign contract in '${contract.status}' status`, 400));
    }

    await contract.save();

    const populated = await Contract.findById(contract._id)
      .populate('campaign', 'title')
      .populate('brand', 'name email avatar')
      .populate('influencer', 'name email avatar');

    // Notify the other party
    const io = req.app.get('io');
    if (io) {
      const notifyUserId = isBrand ? contract.influencer.toString() : contract.brand.toString();
      io.to(`user:${notifyUserId}`).emit('contractSigned', {
        contractId: contract._id,
        signedBy: req.user.name,
        status: contract.status,
      });
    }

    return success(res, { contract: populated }, 'Contract signed successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update contract terms (only by brand, resets signatures)
// @route   PUT /api/v1/contracts/:contractId
exports.updateContract = async (req, res, next) => {
  try {
    const contract = await Contract.findOne({
      _id: req.params.contractId,
      brand: req.user._id,
      status: { $in: ['draft', 'pending_influencer', 'pending_brand'] },
    });

    if (!contract) {
      return next(new AppError('Contract not found or cannot be edited', 404));
    }

    const { title, terms, deliverables, compensation, timeline, exclusivity, usageRights, cancellationPolicy, notes } = req.body;

    if (title !== undefined) contract.title = title;
    if (terms !== undefined) contract.terms = terms;
    if (deliverables !== undefined) contract.deliverables = deliverables;
    if (compensation !== undefined) contract.compensation = { ...contract.compensation, ...compensation };
    if (timeline !== undefined) {
      if (timeline.startDate) contract.timeline.startDate = new Date(timeline.startDate);
      if (timeline.endDate) contract.timeline.endDate = new Date(timeline.endDate);
    }
    if (exclusivity !== undefined) contract.exclusivity = exclusivity;
    if (usageRights !== undefined) contract.usageRights = usageRights;
    if (cancellationPolicy !== undefined) contract.cancellationPolicy = cancellationPolicy;
    if (notes !== undefined) contract.notes = notes;

    // Reset influencer signature since terms changed
    contract.influencerSignature = { signed: false };
    contract.status = 'pending_influencer';
    contract.brandSignature = { signed: true, signedAt: new Date(), ipAddress: req.ip };

    // Add revision record
    contract.revisions.push({
      revisedBy: req.user._id,
      changes: 'Contract terms updated',
      revisedAt: new Date(),
    });

    await contract.save();

    const populated = await Contract.findById(contract._id)
      .populate('campaign', 'title')
      .populate('brand', 'name email avatar')
      .populate('influencer', 'name email avatar');

    return success(res, { contract: populated }, 'Contract updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a contract
// @route   PUT /api/v1/contracts/:contractId/cancel
exports.cancelContract = async (req, res, next) => {
  try {
    const contract = await Contract.findOne({
      _id: req.params.contractId,
      $or: [{ brand: req.user._id }, { influencer: req.user._id }],
      status: { $nin: ['completed', 'cancelled'] },
    });

    if (!contract) {
      return next(new AppError('Contract not found or already finalized', 404));
    }

    contract.status = 'cancelled';
    contract.revisions.push({
      revisedBy: req.user._id,
      changes: `Contract cancelled by ${req.user.role}`,
      revisedAt: new Date(),
    });
    await contract.save();

    // Notify the other party
    const io = req.app.get('io');
    if (io) {
      const userId = req.user._id.toString();
      const notifyUserId = contract.brand.toString() === userId
        ? contract.influencer.toString()
        : contract.brand.toString();
      io.to(`user:${notifyUserId}`).emit('contractCancelled', {
        contractId: contract._id,
        cancelledBy: req.user.name,
      });
    }

    return success(res, { contract }, 'Contract cancelled');
  } catch (error) {
    next(error);
  }
};

// @desc    Get contracts for a specific campaign
// @route   GET /api/v1/contracts/campaign/:campaignId
exports.getContractsByCampaign = async (req, res, next) => {
  try {
    const contracts = await Contract.find({
      campaign: req.params.campaignId,
      $or: [{ brand: req.user._id }, { influencer: req.user._id }],
    })
      .populate('brand', 'name email avatar')
      .populate('influencer', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    return success(res, { contracts });
  } catch (error) {
    next(error);
  }
};
