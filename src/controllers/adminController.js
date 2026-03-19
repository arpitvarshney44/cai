const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Application = require('../models/Application');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Admin login
// @route   POST /api/v1/admin/login
exports.adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'admin' }).select('+password');
    if (!user) {
      return next(new AppError('Invalid credentials', 401));
    }

    if (user.isBlocked) {
      return next(new AppError('This account has been disabled', 403));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid credentials', 401));
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    return success(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
      },
      accessToken,
      refreshToken,
    }, 'Admin login successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users with filters & pagination
// @route   GET /api/v1/admin/users
exports.getAllUsers = async (req, res, next) => {
  try {
    const {
      role, isBlocked, isVerified, search,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password -refreshToken -otp'),
      User.countDocuments(filter),
    ]);

    return success(res, {
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user detail
// @route   GET /api/v1/admin/users/:id
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken -otp');
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    return success(res, { user });
  } catch (error) {
    next(error);
  }
};

// @desc    Block / Unblock a user
// @route   PUT /api/v1/admin/users/:id/block
exports.toggleBlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    if (user.role === 'admin') {
      return next(new AppError('Cannot block an admin account', 403));
    }

    user.isBlocked = !user.isBlocked;
    // Invalidate session on block
    if (user.isBlocked) user.refreshToken = undefined;
    await user.save();

    return success(res, {
      isBlocked: user.isBlocked,
    }, `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/v1/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    if (user.role === 'admin') {
      return next(new AppError('Cannot delete an admin account', 403));
    }

    await user.deleteOne();
    return success(res, null, 'User deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get platform stats (users + campaigns)
// @route   GET /api/v1/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, totalBrands, totalInfluencers, blockedUsers, unverifiedUsers, recentSignups,
      totalCampaigns, activeCampaigns, completedCampaigns, totalApplications,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'brand' }),
      User.countDocuments({ role: 'influencer' }),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({ isVerified: false, role: { $ne: 'admin' } }),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo }, role: { $ne: 'admin' } }),
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: 'active' }),
      Campaign.countDocuments({ status: 'completed' }),
      Application.countDocuments(),
    ]);

    return success(res, {
      totalUsers,
      totalBrands,
      totalInfluencers,
      blockedUsers,
      unverifiedUsers,
      recentSignups,
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalApplications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new admin user
// @route   POST /api/v1/admin/create-admin
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return next(new AppError('Email already registered', 400));
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
      isVerified: true,
    });

    return success(res, {
      user: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    }, 'Admin created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// ─── Campaign Management ──────────────────────────────

// @desc    List all campaigns with filters
// @route   GET /api/v1/admin/campaigns
exports.getAllCampaigns = async (req, res, next) => {
  try {
    const {
      status, niche, platform, search, flagged,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (niche) filter.niche = niche;
    if (platform) filter.platform = platform;
    if (flagged === 'true') filter.isFlagged = true;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate('brand', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Campaign.countDocuments(filter),
    ]);

    return success(res, {
      campaigns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get campaign detail (admin)
// @route   GET /api/v1/admin/campaigns/:id
exports.getCampaignById = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('brand', 'name email avatar');
    if (!campaign) return next(new AppError('Campaign not found', 404));

    const applicationsCount = await Application.countDocuments({ campaign: req.params.id });

    return success(res, { campaign, applicationsCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Moderate campaign (approve/reject/flag/remove)
// @route   PUT /api/v1/admin/campaigns/:id/moderate
exports.moderateCampaign = async (req, res, next) => {
  try {
    const { action, reason } = req.body;

    const validActions = ['approve', 'reject', 'flag', 'unflag', 'remove'];
    if (!validActions.includes(action)) {
      return next(new AppError(`Action must be one of: ${validActions.join(', ')}`, 400));
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    switch (action) {
      case 'approve':
        campaign.status = 'active';
        campaign.moderationNote = reason || undefined;
        break;
      case 'reject':
        campaign.status = 'cancelled';
        campaign.moderationNote = reason || 'Rejected by admin';
        break;
      case 'flag':
        campaign.isFlagged = true;
        campaign.moderationNote = reason || 'Flagged for review';
        break;
      case 'unflag':
        campaign.isFlagged = false;
        campaign.moderationNote = undefined;
        break;
      case 'remove':
        await campaign.deleteOne();
        return success(res, null, 'Campaign removed permanently');
    }

    await campaign.save();
    return success(res, { campaign }, `Campaign ${action}${action.endsWith('e') ? 'd' : 'ed'}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Campaign analytics
// @route   GET /api/v1/admin/campaigns/stats
exports.getCampaignStats = async (req, res, next) => {
  try {
    const statusCounts = await Campaign.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const nicheCounts = await Campaign.aggregate([
      { $unwind: '$niche' },
      { $group: { _id: '$niche', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const platformCounts = await Campaign.aggregate([
      { $unwind: '$platform' },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const budgetStats = await Campaign.aggregate([
      { $group: {
        _id: null,
        avgMin: { $avg: '$budget.min' },
        avgMax: { $avg: '$budget.max' },
        totalBudget: { $sum: '$budget.max' },
      } },
    ]);

    const flaggedCount = await Campaign.countDocuments({ isFlagged: true });

    return success(res, {
      statusCounts: statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      topNiches: nicheCounts,
      platformDistribution: platformCounts,
      budgetStats: budgetStats[0] || {},
      flaggedCount,
    });
  } catch (error) {
    next(error);
  }
};

