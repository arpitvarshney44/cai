const User = require('../models/User');
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

// @desc    Get platform stats
// @route   GET /api/v1/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [totalUsers, totalBrands, totalInfluencers, blockedUsers, unverifiedUsers] =
      await Promise.all([
        User.countDocuments({ role: { $ne: 'admin' } }),
        User.countDocuments({ role: 'brand' }),
        User.countDocuments({ role: 'influencer' }),
        User.countDocuments({ isBlocked: true }),
        User.countDocuments({ isVerified: false, role: { $ne: 'admin' } }),
      ]);

    // Signups in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSignups = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      role: { $ne: 'admin' },
    });

    return success(res, {
      totalUsers,
      totalBrands,
      totalInfluencers,
      blockedUsers,
      unverifiedUsers,
      recentSignups,
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
