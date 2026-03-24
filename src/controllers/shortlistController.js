const Shortlist = require('../models/Shortlist');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Get all my shortlists
// @route   GET /api/v1/discovery/shortlists
exports.getMyShortlists = async (req, res, next) => {
  try {
    const shortlists = await Shortlist.find({ user: req.user._id })
      .populate({
        path: 'influencers',
        populate: { path: 'user', select: 'name email avatar' },
      })
      .sort({ updatedAt: -1 });

    return success(res, { shortlists });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a named shortlist
// @route   POST /api/v1/discovery/shortlists
exports.createShortlist = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return next(new AppError('List name is required', 400));

    const shortlist = await Shortlist.create({
      user: req.user._id,
      name: name.trim(),
      influencers: [],
    });

    return success(res, { shortlist }, 'Shortlist created', 201);
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('A list with this name already exists', 400));
    }
    next(error);
  }
};

// @desc    Add influencer to a shortlist
// @route   POST /api/v1/discovery/shortlists/:listId/add
exports.addToShortlist = async (req, res, next) => {
  try {
    const { influencerProfileId } = req.body;
    if (!influencerProfileId) return next(new AppError('influencerProfileId is required', 400));

    const shortlist = await Shortlist.findOne({ _id: req.params.listId, user: req.user._id });
    if (!shortlist) return next(new AppError('Shortlist not found', 404));

    if (shortlist.influencers.includes(influencerProfileId)) {
      return success(res, { shortlist }, 'Already in list');
    }

    shortlist.influencers.push(influencerProfileId);
    await shortlist.save();

    return success(res, { shortlist }, 'Added to shortlist');
  } catch (error) {
    next(error);
  }
};

// @desc    Remove influencer from a shortlist
// @route   POST /api/v1/discovery/shortlists/:listId/remove
exports.removeFromShortlist = async (req, res, next) => {
  try {
    const { influencerProfileId } = req.body;

    const shortlist = await Shortlist.findOne({ _id: req.params.listId, user: req.user._id });
    if (!shortlist) return next(new AppError('Shortlist not found', 404));

    shortlist.influencers = shortlist.influencers.filter(
      id => id.toString() !== influencerProfileId
    );
    await shortlist.save();

    return success(res, { shortlist }, 'Removed from shortlist');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a shortlist
// @route   DELETE /api/v1/discovery/shortlists/:listId
exports.deleteShortlist = async (req, res, next) => {
  try {
    const shortlist = await Shortlist.findOneAndDelete({
      _id: req.params.listId,
      user: req.user._id,
    });
    if (!shortlist) return next(new AppError('Shortlist not found', 404));

    return success(res, null, 'Shortlist deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Quick toggle favorite (auto-creates "Favorites" list)
// @route   POST /api/v1/discovery/favorites/toggle
exports.toggleFavorite = async (req, res, next) => {
  try {
    const { influencerProfileId } = req.body;
    if (!influencerProfileId) return next(new AppError('influencerProfileId is required', 400));

    let favList = await Shortlist.findOne({ user: req.user._id, name: 'Favorites' });
    if (!favList) {
      favList = await Shortlist.create({ user: req.user._id, name: 'Favorites', influencers: [] });
    }

    const idx = favList.influencers.findIndex(id => id.toString() === influencerProfileId);
    const isFavorited = idx === -1;

    if (isFavorited) {
      favList.influencers.push(influencerProfileId);
    } else {
      favList.influencers.splice(idx, 1);
    }
    await favList.save();

    return success(res, { isFavorited, shortlist: favList },
      isFavorited ? 'Added to favorites' : 'Removed from favorites'
    );
  } catch (error) {
    next(error);
  }
};
