const BrandProfile = require('../models/BrandProfile');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Create or update brand profile
// @route   PUT /api/v1/brand/profile
exports.upsertProfile = async (req, res, next) => {
  try {
    const {
      companyName, industry, website, description,
      targetAudience, socialLinks, location,
    } = req.body;

    let profile = await BrandProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new BrandProfile({ user: req.user._id });
    }

    if (companyName !== undefined) profile.companyName = companyName;
    if (industry !== undefined) profile.industry = industry;
    if (website !== undefined) profile.website = website;
    if (description !== undefined) profile.description = description;
    if (targetAudience !== undefined) profile.targetAudience = targetAudience;
    if (socialLinks !== undefined) profile.socialLinks = { ...profile.socialLinks, ...socialLinks };
    if (location !== undefined) profile.location = location;

    await profile.save();

    // Mark profile complete on user immediately when they save any profile info
    if (!req.user.isProfileComplete) {
      await User.findByIdAndUpdate(req.user._id, { isProfileComplete: true });
    }

    return success(res, { profile }, 'Brand profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get my brand profile
// @route   GET /api/v1/brand/profile/me
exports.getMyProfile = async (req, res, next) => {
  try {
    const profile = await BrandProfile.findOne({ user: req.user._id })
      .populate('user', 'name email avatar');

    if (!profile) {
      return success(res, { profile: null }, 'Profile not created yet');
    }

    return success(res, { profile });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public brand profile
// @route   GET /api/v1/brand/profile/:userId
exports.getPublicProfile = async (req, res, next) => {
  try {
    const profile = await BrandProfile.findOne({ user: req.params.userId })
      .populate('user', 'name email avatar');

    if (!profile) {
      return next(new AppError('Brand profile not found', 404));
    }

    return success(res, { profile });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload brand logo
// @route   POST /api/v1/brand/profile/upload-logo
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const logoUrl = `/uploads/${req.file.filename}`;

    let profile = await BrandProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new BrandProfile({ user: req.user._id });
    }
    profile.logo = logoUrl;
    await profile.save();

    await User.findByIdAndUpdate(req.user._id, { avatar: logoUrl });

    return success(res, { logoUrl }, 'Logo uploaded successfully');
  } catch (error) {
    next(error);
  }
};
