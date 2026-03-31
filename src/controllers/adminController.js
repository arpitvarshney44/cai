const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Application = require('../models/Application');
const InfluencerProfile = require('../models/InfluencerProfile');
const BrandProfile = require('../models/BrandProfile');
const AuditLog = require('../models/AuditLog');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// Helper: create audit log
const createAuditLog = async (adminId, action, targetType, targetId, description, severity = 'info', extra = {}) => {
  try {
    await AuditLog.create({
      admin: adminId,
      action,
      targetType,
      targetId,
      description,
      severity,
      ...extra,
    });
  } catch (err) {
    console.error('Audit log creation failed:', err.message);
  }
};

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

    // Log the successful login
    await createAuditLog(user._id, 'admin_login', 'system', null, `Admin logged in from ${req.ip}`, 'info', { ipAddress: req.ip, userAgent: req.get('User-Agent') });

    return success(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        adminRole: user.adminRole || 'super_admin',
        permissions: user.permissions || [],
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
      role, isBlocked, isVerified, status, search,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';

    // Combined status filter from admin panel
    if (status === 'verified') {
      filter.isVerified = true;
      filter.isBlocked = false;
    } else if (status === 'unverified') {
      filter.isVerified = false;
      filter.isBlocked = false;
    } else if (status === 'blocked') {
      filter.isBlocked = true;
    }

    // Advanced search: name, email, or _id
    if (search) {
      const orConditions = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
      // Check if search term is a valid MongoDB ObjectId
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        orConditions.push({ _id: search });
      }
      filter.$or = orConditions;
    }

    // Historical filtering: after specific joined date
    if (req.query.joinedDate) {
      const startDate = new Date(req.query.joinedDate);
      const endDate = new Date(req.query.joinedDate);
      endDate.setDate(endDate.getDate() + 1); // Get full day window
      filter.createdAt = { $gte: startDate, $lt: endDate };
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

// @desc    Get single user detail with profile data
// @route   GET /api/v1/admin/users/:id
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken -otp');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Fetch associated profile
    let profile = null;
    if (user.role === 'influencer') {
      profile = await InfluencerProfile.findOne({ user: user._id });
    } else if (user.role === 'brand') {
      profile = await BrandProfile.findOne({ user: user._id });
    }

    // Get recent activity from audit logs (actions taken on or by this user)
    const recentActivity = await AuditLog.find({
      $or: [
        { targetId: user._id, targetType: 'user' },
        { admin: user._id },
      ],
    })
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    // Get user's campaign stats
    let campaignStats = { total: 0, active: 0, completed: 0 };
    if (user.role === 'brand') {
      const [total, active, completed] = await Promise.all([
        Campaign.countDocuments({ brand: user._id }),
        Campaign.countDocuments({ brand: user._id, status: 'active' }),
        Campaign.countDocuments({ brand: user._id, status: 'completed' }),
      ]);
      campaignStats = { total, active, completed };
    } else if (user.role === 'influencer') {
      const [total, active, completed] = await Promise.all([
        Application.countDocuments({ influencer: user._id }),
        Application.countDocuments({ influencer: user._id, status: 'accepted' }),
        Application.countDocuments({ influencer: user._id, status: 'completed' }),
      ]);
      campaignStats = { total, active, completed };
    }

    return success(res, {
      user,
      profile,
      recentActivity,
      campaignStats,
    });
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

    const wasPreviouslyBlocked = user.isBlocked;
    user.isBlocked = !user.isBlocked;
    // Invalidate session on block
    if (user.isBlocked) user.refreshToken = undefined;
    await user.save();

    await createAuditLog(
      req.user._id,
      user.isBlocked ? 'user_blocked' : 'user_unblocked',
      'user',
      user._id,
      `${user.isBlocked ? 'Blocked' : 'Unblocked'} user ${user.email}. Reason: ${reason || 'N/A'}`,
      user.isBlocked ? 'warning' : 'info'
    );

    return success(res, { isBlocked: user.isBlocked }, `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`);
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

    const userName = user.name;
    const userEmail = user.email;

    // Also delete associated profile
    if (user.role === 'influencer') {
      await InfluencerProfile.findOneAndDelete({ user: user._id });
    } else if (user.role === 'brand') {
      await BrandProfile.findOneAndDelete({ user: user._id });
    }

    await user.deleteOne();

    await createAuditLog(
      req.user._id,
      'user_deleted',
      'user',
      req.params.id,
      `Deleted user: ${userName} (${userEmail})`,
      'critical'
    );

    return success(res, null, 'User deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Verify / Unverify a user
// @route   PUT /api/v1/admin/users/:id/verify
exports.toggleVerifyUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    user.isVerified = !user.isVerified;
    if (user.isVerified) user.verifiedAt = new Date();
    await user.save();

    // Also update verification on profile if exists
    if (user.role === 'influencer') {
      await InfluencerProfile.findOneAndUpdate(
        { user: user._id },
        { isVerified: user.isVerified }
      );
    } else if (user.role === 'brand') {
      await BrandProfile.findOneAndUpdate(
        { user: user._id },
        { isVerified: user.isVerified, ...(user.isVerified ? { verifiedAt: new Date() } : {}) }
      );
    }

    await createAuditLog(
      req.user._id,
      'user_verified',
      'user',
      user._id,
      `${user.isVerified ? 'Verified' : 'Unverified'} user ${user.email}`,
      'info'
    );

    return success(res, {
      isVerified: user.isVerified,
    }, `User ${user.isVerified ? 'verified' : 'unverified'} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Edit user profile manually (admin)
// @route   PUT /api/v1/admin/users/:id/profile
exports.updateUserProfile = async (req, res, next) => {
  try {
    const { name, email, role, bio, location, website, company, niche } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const previousData = { name: user.name, email: user.email, role: user.role };

    // Update base user fields
    if (name) user.name = name;
    if (email && email !== user.email) {
      const existing = await User.findOne({ email, _id: { $ne: user._id } });
      if (existing) return next(new AppError('Email already in use by another account', 400));
      user.email = email;
    }
    // Don't allow role change to admin for security
    if (role && role !== 'admin' && user.role !== 'admin') {
      user.role = role;
    }
    await user.save();

    // Update corresponding profile
    if (user.role === 'influencer') {
      const profileUpdate = {};
      if (bio !== undefined) profileUpdate.bio = bio;
      if (location !== undefined) {
        profileUpdate.location = typeof location === 'string'
          ? { city: location } : location;
      }
      if (niche !== undefined) profileUpdate.niche = niche;

      await InfluencerProfile.findOneAndUpdate(
        { user: user._id },
        { $set: profileUpdate },
        { upsert: true, new: true }
      );
    } else if (user.role === 'brand') {
      const profileUpdate = {};
      if (bio !== undefined) profileUpdate.description = bio;
      if (website !== undefined) profileUpdate.website = website;
      if (company !== undefined) profileUpdate.companyName = company;
      if (location !== undefined) {
        profileUpdate.location = typeof location === 'string'
          ? { city: location } : location;
      }

      await BrandProfile.findOneAndUpdate(
        { user: user._id },
        { $set: profileUpdate },
        { upsert: true, new: true }
      );
    }

    await createAuditLog(
      req.user._id,
      'user_profile_edited', 
      'user',
      user._id,
      `Admin edited profile of user: ${user.name} (${user.email})`,
      'info',
      { previousData, newData: { name: user.name, email: user.email, role: user.role } }
    );

    // Re-fetch full user data to return
    const updatedUser = await User.findById(user._id).select('-password -refreshToken -otp');
    let profile = null;
    if (updatedUser.role === 'influencer') {
      profile = await InfluencerProfile.findOne({ user: updatedUser._id });
    } else if (updatedUser.role === 'brand') {
      profile = await BrandProfile.findOne({ user: updatedUser._id });
    }

    return success(res, { user: updatedUser, profile }, 'User profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get user activity history
// @route   GET /api/v1/admin/users/:id/activity
exports.getUserActivity = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const userId = req.params.id;

    const user = await User.findById(userId).select('name email role lastLogin createdAt');
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get audit logs related to this user
    const filter = {
      $or: [
        { targetId: userId, targetType: 'user' },
        { admin: userId },
      ],
    };

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('admin', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    // Build a combined activity timeline
    const activity = [
      // Login info
      {
        type: 'login',
        description: 'Last login',
        timestamp: user.lastLogin || null,
        severity: 'info',
      },
      {
        type: 'account_created',
        description: 'Account created',
        timestamp: user.createdAt,
        severity: 'info',
      },
    ];

    return success(res, {
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, lastLogin: user.lastLogin },
      auditLogs: logs,
      activity,
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

// @desc    Get platform stats (users + campaigns)
// @route   GET /api/v1/admin/stats
 exports.getStats = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, totalBrands, totalInfluencers, activeCampaigns,
      totalApplications, acceptedApplications,
      recentSignups,
      topInfluencers,
      topBrands,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'brand' }),
      User.countDocuments({ role: 'influencer' }),
      Campaign.countDocuments({ status: 'active' }),
      Application.countDocuments(),
      Application.countDocuments({ status: 'accepted' }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, role: { $ne: 'admin' } }),
      // Top Influencers (by followers/activity - simplified for now)
      User.find({ role: 'influencer' }).sort({ createdAt: -1 }).limit(5).select('name email'),
      // Top Brands
      User.find({ role: 'brand' }).sort({ createdAt: -1 }).limit(5).select('name email'),
    ]);

    // Conversion rate: (Accepted Apps / Total Apps) * 100
    const conversionRate = totalApplications > 0 
      ? ((acceptedApplications / totalApplications) * 100).toFixed(1) 
      : 0;

    // Growth Metrics - Simple month over month
    const lastMonthSignups = await User.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo, $lt: new Date() }, 
      role: { $ne: 'admin' } 
    });

    return success(res, {
      metrics: {
        totalUsers,
        totalBrands,
        totalInfluencers,
        activeCampaigns,
        conversionRate,
        growth: lastMonthSignups,
      },
      topCreators: topInfluencers,
      topBrands: topBrands,
      recentSignupsCount: recentSignups,
    });
  } catch (error) {
    next(error);
  }
};


// @desc    Create a new admin user
// @route   POST /api/v1/admin/create-admin
exports.createAdmin = async (req, res, next) => {
  try {
    const { name, email, password, adminRole, permissions } = req.body;

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
      adminRole: adminRole || 'moderator',
      permissions: permissions || [],
    });

    await createAuditLog(req.user._id, 'admin_created', 'user', admin._id,
      `Created admin ${admin.name} (${admin.email}) with role ${admin.adminRole}`, 'warning');

    return success(res, {
      user: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role, adminRole: admin.adminRole },
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

// @desc    Moderate campaign (approve/reject/flag/unflag/pause/unpause/remove)
// @route   PUT /api/v1/admin/campaigns/:id/moderate
exports.moderateCampaign = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    campaign.status = status;
    if (status === 'active') campaign.isApproved = true;
    campaign.moderatedBy = req.user._id;
    campaign.moderatedAt = new Date();
    campaign.moderationNote = note;
    await campaign.save();

    await createAuditLog(
      req.user._id,
      status === 'active' ? 'campaign_approved' : 'campaign_rejected',
      'campaign',
      campaign._id,
      `${status === 'active' ? 'Approved' : 'Rejected'} campaign: ${campaign.title}. Note: ${note || 'N/A'}`,
      status === 'active' ? 'info' : 'warning'
    );

    return success(res, campaign, `Campaign ${status} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Edit campaign details (admin override)
// @route   PUT /api/v1/admin/campaigns/:id/edit
exports.editCampaignAdmin = async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return next(new AppError('Campaign not found', 404));

    const previousData = {
      title: campaign.title,
      description: campaign.description,
      status: campaign.status,
    };

    const allowedFields = [
      'title', 'description', 'niche', 'platform', 'budget',
      'deliverables', 'milestones', 'timeline', 'requirements',
      'status', 'coverImage', 'tags', 'maxApplications',
      'isFeatured', 'isAdminApproved',
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        campaign[field] = req.body[field];
      }
    });

    if (req.body.moderationNote !== undefined) {
      campaign.moderationNote = req.body.moderationNote;
    }

    await campaign.save();

    await createAuditLog(
      req.user._id,
      'campaign_approved', // closest available action
      'campaign',
      campaign._id,
      `Admin edited campaign: ${campaign.title}`,
      'info',
      { previousData, newData: { title: campaign.title, description: campaign.description, status: campaign.status } }
    );

    const updated = await Campaign.findById(campaign._id).populate('brand', 'name email avatar');
    return success(res, { campaign: updated }, 'Campaign updated successfully');
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

// ─── Application Management ──────────────────────────────

// @desc    List all applications with filters (admin)
// @route   GET /api/v1/admin/applications
exports.getAllApplications = async (req, res, next) => {
  try {
    const {
      status, campaignId, influencerId, isSpam,
      search, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (campaignId) filter.campaign = campaignId;
    if (influencerId) filter.influencer = influencerId;
    if (isSpam === 'true') filter.isSpam = true;
    if (isSpam === 'false') filter.isSpam = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    // Build the query
    let query = Application.find(filter)
      .populate('influencer', 'name email avatar isVerified isBlocked')
      .populate({
        path: 'campaign',
        select: 'title status brand niche platform budget applicationsCount',
        populate: { path: 'brand', select: 'name email' },
      })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit));

    const [applications, total] = await Promise.all([
      query,
      Application.countDocuments(filter),
    ]);

    // If search term provided, do post-filter (for flexible name/email/campaign search)
    let filtered = applications;
    if (search) {
      const s = search.toLowerCase();
      filtered = applications.filter(app =>
        (app.influencer?.name?.toLowerCase().includes(s)) ||
        (app.influencer?.email?.toLowerCase().includes(s)) ||
        (app.campaign?.title?.toLowerCase().includes(s)) ||
        (app.pitch?.toLowerCase().includes(s))
      );
    }

    return success(res, {
      applications: filtered,
      pagination: {
        total: search ? filtered.length : total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single application detail
// @route   GET /api/v1/admin/applications/:id
exports.getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('influencer', 'name email avatar isVerified isBlocked role createdAt lastLogin')
      .populate({
        path: 'campaign',
        select: 'title description status brand niche platform budget timeline requirements applicationsCount maxApplications isFlagged moderationNote',
        populate: { path: 'brand', select: 'name email avatar' },
      });

    if (!application) return next(new AppError('Application not found', 404));

    // Get influencer profile stats
    let influencerProfile = null;
    if (application.influencer) {
      influencerProfile = await InfluencerProfile.findOne({ user: application.influencer._id })
        .select('bio niche totalFollowers avgEngagementRate aiScore totalCampaigns completionPercentage socialAccounts');
    }

    // Get other applications from this influencer (detect spam patterns)
    const otherApps = await Application.countDocuments({
      influencer: application.influencer?._id,
      _id: { $ne: application._id },
    });
    const recentApps = await Application.countDocuments({
      influencer: application.influencer?._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    // Spam indicators
    const spamIndicators = [];
    if (recentApps > 10) spamIndicators.push('High volume: 10+ applications in 24h');
    if (application.pitch && application.pitch.length < 20) spamIndicators.push('Very short pitch (under 20 chars)');
    if (influencerProfile && influencerProfile.totalFollowers < 100) spamIndicators.push('Very low follower count (<100)');
    if (influencerProfile && influencerProfile.completionPercentage < 30) spamIndicators.push('Incomplete profile (<30%)');
    if (application.influencer && !application.influencer.isVerified) spamIndicators.push('Unverified account');

    return success(res, {
      application,
      influencerProfile,
      spamAnalysis: {
        totalApplications: otherApps + 1,
        recentApplications24h: recentApps,
        indicators: spamIndicators,
        riskLevel: spamIndicators.length >= 3 ? 'high' : spamIndicators.length >= 1 ? 'medium' : 'low',
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin override — approve or reject an application
// @route   PUT /api/v1/admin/applications/:id/override
exports.overrideApplication = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return next(new AppError('Status must be accepted or rejected', 400));
    }

    const application = await Application.findById(req.params.id)
      .populate('influencer', 'name email')
      .populate('campaign', 'title brand');
    if (!application) return next(new AppError('Application not found', 404));

    const previousStatus = application.status;
    application.status = status;
    application.adminNote = adminNote || `Admin override: ${status}`;
    application.respondedAt = new Date();
    await application.save();

    // If accepted and campaign is active, move to in_progress
    if (status === 'accepted') {
      const campaign = await Campaign.findById(application.campaign._id || application.campaign);
      if (campaign && campaign.status === 'active') {
        campaign.status = 'in_progress';
        await campaign.save();
      }
    }

    const auditAction = status === 'accepted' ? 'application_override_approved' : 'application_override_rejected';
    await createAuditLog(
      req.user._id,
      auditAction,
      'application',
      application._id,
      `Admin ${status} application from ${application.influencer?.name || 'Unknown'} for campaign: ${application.campaign?.title || 'Unknown'} (was: ${previousStatus})`,
      'warning',
      { previousStatus, newStatus: status }
    );

    return success(res, { application }, `Application ${status} (admin override)`);
  } catch (error) {
    next(error);
  }
};

// @desc    Flag/unflag application as spam
// @route   PUT /api/v1/admin/applications/:id/spam
exports.toggleSpamApplication = async (req, res, next) => {
  try {
    const { isSpam, adminNote } = req.body;

    const application = await Application.findById(req.params.id)
      .populate('influencer', 'name email')
      .populate('campaign', 'title');
    if (!application) return next(new AppError('Application not found', 404));

    application.isSpam = isSpam !== undefined ? isSpam : !application.isSpam;
    if (adminNote) application.adminNote = adminNote;

    // Auto-reject spam applications
    if (application.isSpam && application.status === 'pending') {
      application.status = 'rejected';
      application.respondedAt = new Date();
    }

    await application.save();

    if (application.isSpam) {
      await createAuditLog(
        req.user._id,
        'application_flagged_spam',
        'application',
        application._id,
        `Flagged application as spam from ${application.influencer?.name || 'Unknown'} for campaign: ${application.campaign?.title || 'Unknown'}`,
        'warning'
      );
    }

    return success(res, { application }, `Application ${application.isSpam ? 'flagged as spam' : 'unflagged'}`);
  } catch (error) {
    next(error);
  }
};

// @desc    Get application stats
// @route   GET /api/v1/admin/applications/stats
exports.getApplicationStats = async (req, res, next) => {
  try {
    const statusCounts = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const spamCount = await Application.countDocuments({ isSpam: true });
    const totalCount = await Application.countDocuments();

    // Applications per day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyCounts = await Application.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top campaigns by application volume
    const topCampaigns = await Application.aggregate([
      { $group: { _id: '$campaign', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'campaigns',
          localField: '_id',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          count: 1,
          'campaign.title': 1,
          'campaign.status': 1,
        },
      },
    ]);

    // Potential spam users (users with 10+ applications in last 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const suspiciousUsers = await Application.aggregate([
      { $match: { createdAt: { $gte: oneDayAgo } } },
      { $group: { _id: '$influencer', count: { $sum: 1 } } },
      { $match: { count: { $gte: 10 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          count: 1,
          'user.name': 1,
          'user.email': 1,
          'user.isVerified': 1,
        },
      },
    ]);

    return success(res, {
      total: totalCount,
      statusCounts: statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      spamCount,
      dailyCounts,
      topCampaigns,
      suspiciousUsers,
    });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════
// NOTIFICATION MANAGEMENT
// ═══════════════════════════════════════

const Notification = require('../models/Notification');

// @desc    Get notification logs
// @route   GET /api/v1/admin/notifications/logs
exports.getNotificationLogs = async (req, res, next) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip).limit(Number(limit)).lean(),
      Notification.countDocuments(filter),
    ]);

    const stats = await Notification.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 }, read: { $sum: { $cond: ['$read', 1, 0] } } } },
      { $sort: { count: -1 } },
    ]);

    return success(res, {
      notifications, stats,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

// @desc    Send announcement to users
// @route   POST /api/v1/admin/notifications/send
exports.sendAnnouncement = async (req, res, next) => {
  try {
    const { title, body, targetRole, targetUserIds } = req.body;
    if (!title || !body) return next(new AppError('Title and body are required', 400));

    let userFilter = { role: { $ne: 'admin' } };
    if (targetRole) userFilter.role = targetRole;
    if (targetUserIds?.length) userFilter = { _id: { $in: targetUserIds } };

    const users = await User.find(userFilter).select('_id').lean();
    const notifications = users.map(u => ({
      user: u._id, type: 'system', title, body,
      data: { screen: 'Notifications', referenceType: 'announcement' },
    }));

    if (notifications.length > 0) await Notification.insertMany(notifications);

    await AuditLog.create({
      admin: req.user._id, action: 'bulk_action', targetType: 'system',
      description: `Sent announcement "${title}" to ${notifications.length} users`,
      severity: 'info',
    });

    return success(res, { sent: notifications.length }, 'Announcement sent');
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════
// SYSTEM HEALTH
// ═══════════════════════════════════════

// @desc    Get system health metrics
// @route   GET /api/v1/admin/system/health
exports.getSystemHealth = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const os = require('os');

    const dbState = mongoose.connection.readyState; // 0=disconnected, 1=connected, 2=connecting
    const uptime = process.uptime();

    // DB stats
    const dbStats = await mongoose.connection.db.stats();

    // Collection counts
    const [users, campaigns, payments, notifications] = await Promise.all([
      User.countDocuments(),
      Campaign.countDocuments(),
      require('../models/Payment').countDocuments(),
      Notification.countDocuments(),
    ]);

    return success(res, {
      server: {
        status: 'running',
        uptime: Math.floor(uptime),
        uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        nodeVersion: process.version,
        platform: os.platform(),
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024),
          used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
          usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
        },
        cpu: os.cpus().length,
      },
      database: {
        status: dbState === 1 ? 'connected' : 'disconnected',
        name: dbStats.db,
        collections: dbStats.collections,
        dataSize: Math.round(dbStats.dataSize / 1024 / 1024),
        storageSize: Math.round(dbStats.storageSize / 1024 / 1024),
        indexes: dbStats.indexes,
      },
      counts: { users, campaigns, payments, notifications },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════
// ADMIN ROLE MANAGEMENT
// ═══════════════════════════════════════

// @desc    Get all admin users
// @route   GET /api/v1/admin/admins
exports.getAllAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('name email role adminRole permissions createdAt lastLogin')
      .sort({ createdAt: -1 }).lean();
    return success(res, { admins });
  } catch (err) { next(err); }
};

// @desc    Update admin role/permissions
// @route   PUT /api/v1/admin/admins/:id/role
exports.updateAdminRole = async (req, res, next) => {
  try {
    const { adminRole, permissions } = req.body;
    const admin = await User.findById(req.params.id);
    if (!admin || admin.role !== 'admin') return next(new AppError('Admin not found', 404));

    if (adminRole) admin.adminRole = adminRole;
    if (permissions) admin.permissions = permissions;
    await admin.save();

    await AuditLog.create({
      admin: req.user._id, action: 'admin_created', targetType: 'user',
      targetId: admin._id, description: `Updated admin role to ${adminRole}`,
      severity: 'warning',
    });

    return success(res, { admin: { _id: admin._id, name: admin.name, adminRole, permissions } });
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════
// CONTENT & MEDIA
// ═══════════════════════════════════════

const fs = require('fs');
const path = require('path');

// @desc    Get uploaded media files
// @route   GET /api/v1/admin/media
exports.getMediaFiles = async (req, res, next) => {
  try {
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) return success(res, { files: [], totalSize: 0 });

    const files = fs.readdirSync(uploadsDir)
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const stat = fs.statSync(path.join(uploadsDir, f));
        return { name: f, size: stat.size, url: `/uploads/${f}`, createdAt: stat.birthtime };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    return success(res, { files, totalSize, count: files.length });
  } catch (err) { next(err); }
};

// @desc    Delete a media file
// @route   DELETE /api/v1/admin/media/:filename
exports.deleteMediaFile = async (req, res, next) => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'uploads', req.params.filename);
    if (!fs.existsSync(filePath)) return next(new AppError('File not found', 404));

    fs.unlinkSync(filePath);

    await AuditLog.create({
      admin: req.user._id, action: 'content_removed', targetType: 'system',
      description: `Deleted media file: ${req.params.filename}`, severity: 'warning',
    });

    return success(res, null, 'File deleted');
  } catch (err) { next(err); }
};
