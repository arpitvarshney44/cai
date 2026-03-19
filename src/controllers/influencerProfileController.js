const InfluencerProfile = require('../models/InfluencerProfile');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Create or update influencer profile
// @route   PUT /api/v1/influencer/profile
exports.upsertProfile = async (req, res, next) => {
  try {
    const {
      bio, niche, location, languages, gender,
      dateOfBirth, pricePerPost, pricePerStory, pricePerVideo,
    } = req.body;

    let profile = await InfluencerProfile.findOne({ user: req.user._id });

    if (!profile) {
      profile = new InfluencerProfile({ user: req.user._id });
    }

    if (bio !== undefined) profile.bio = bio;
    if (niche !== undefined) profile.niche = Array.isArray(niche) ? niche : [niche];
    if (location !== undefined) profile.location = location;
    if (languages !== undefined) profile.languages = languages;
    if (gender !== undefined) profile.gender = gender;
    if (dateOfBirth !== undefined) profile.dateOfBirth = dateOfBirth;
    if (pricePerPost !== undefined) profile.pricePerPost = pricePerPost;
    if (pricePerStory !== undefined) profile.pricePerStory = pricePerStory;
    if (pricePerVideo !== undefined) profile.pricePerVideo = pricePerVideo;

    await profile.save();
    
    // Mark profile complete on user immediately when they save any profile info
    if (!req.user.isProfileComplete) {
      await User.findByIdAndUpdate(req.user._id, { isProfileComplete: true });
    }

    return success(res, { profile }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get my influencer profile
// @route   GET /api/v1/influencer/profile/me
exports.getMyProfile = async (req, res, next) => {
  try {
    const profile = await InfluencerProfile.findOne({ user: req.user._id })
      .populate('user', 'name email avatar');

    if (!profile) {
      return success(res, { profile: null }, 'Profile not created yet');
    }

    return success(res, { profile });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public influencer profile by userId
// @route   GET /api/v1/influencer/profile/:userId
exports.getPublicProfile = async (req, res, next) => {
  try {
    const profile = await InfluencerProfile.findOne({ user: req.params.userId })
      .populate('user', 'name email avatar');

    if (!profile) {
      return next(new AppError('Influencer profile not found', 404));
    }

    return success(res, { profile });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile image
// @route   POST /api/v1/influencer/profile/upload-image
exports.uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    let profile = await InfluencerProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new InfluencerProfile({ user: req.user._id });
    }
    profile.profileImage = imageUrl;
    await profile.save();

    // Also update user avatar
    await User.findByIdAndUpdate(req.user._id, { avatar: imageUrl });

    return success(res, { imageUrl }, 'Profile image uploaded');
  } catch (error) {
    next(error);
  }
};

// @desc    Add portfolio item
// @route   POST /api/v1/influencer/profile/portfolio
exports.addPortfolioItem = async (req, res, next) => {
  try {
    const { type, url, caption, platform } = req.body;

    let profile = await InfluencerProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new InfluencerProfile({ user: req.user._id });
    }

    const item = { type, url, caption, platform };
    if (req.file) item.thumbnail = `/uploads/${req.file.filename}`;

    profile.portfolio.push(item);
    await profile.save();

    return success(res, { portfolio: profile.portfolio }, 'Portfolio item added', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Remove portfolio item
// @route   DELETE /api/v1/influencer/profile/portfolio/:itemId
exports.removePortfolioItem = async (req, res, next) => {
  try {
    const profile = await InfluencerProfile.findOne({ user: req.user._id });
    if (!profile) return next(new AppError('Profile not found', 404));

    profile.portfolio = profile.portfolio.filter(
      (item) => item._id.toString() !== req.params.itemId
    );
    await profile.save();

    return success(res, { portfolio: profile.portfolio }, 'Portfolio item removed');
  } catch (error) {
    next(error);
  }
};

// @desc    Update social media handles (manual entry)
// @route   PUT /api/v1/influencer/profile/social
exports.updateSocialAccounts = async (req, res, next) => {
  try {
    const { socialAccounts } = req.body; // array of { platform, handle, url }

    let profile = await InfluencerProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new InfluencerProfile({ user: req.user._id });
    }

    profile.socialAccounts = socialAccounts;
    profile.recalculateStats();
    await profile.save();

    return success(res, { socialAccounts: profile.socialAccounts }, 'Social accounts updated');
  } catch (error) {
    next(error);
  }
};
