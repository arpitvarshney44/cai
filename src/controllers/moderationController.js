const Report = require('../models/Report');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// ─── Helper: Log audit ────────────────────────────────
const logAudit = async (admin, action, targetType, targetId, description, req, extra = {}) => {
  try {
    await AuditLog.create({
      admin: admin._id || admin,
      action,
      targetType,
      targetId,
      description,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      ...extra,
    });
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
};

// @desc    Get all reports with filters & pagination
// @route   GET /api/v1/admin/moderation/reports
exports.getReports = async (req, res, next) => {
  try {
    const {
      status, targetType, priority, reason,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (targetType) filter.targetType = targetType;
    if (priority) filter.priority = priority;
    if (reason) filter.reason = reason;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate('reporter', 'name email role')
        .populate('reportedUser', 'name email role isBlocked')
        .populate('reviewedBy', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Report.countDocuments(filter),
    ]);

    return success(res, {
      reports,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single report detail
// @route   GET /api/v1/admin/moderation/reports/:id
exports.getReportById = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'name email role avatar')
      .populate('reportedUser', 'name email role avatar isBlocked')
      .populate('reviewedBy', 'name email')
      .populate('assignedTo', 'name email');

    if (!report) return next(new AppError('Report not found', 404));

    // Fetch the target entity details
    let targetDetails = null;
    if (report.targetType === 'user') {
      targetDetails = await User.findById(report.targetId).select('name email role isBlocked isVerified createdAt');
    } else if (report.targetType === 'campaign') {
      targetDetails = await Campaign.findById(report.targetId).select('title status brand isFlagged');
    } else if (report.targetType === 'message') {
      targetDetails = await Message.findById(report.targetId).select('text sender createdAt');
    }

    return success(res, { report, targetDetails });
  } catch (err) {
    next(err);
  }
};

// @desc    Review a report (resolve/dismiss/escalate)
// @route   PUT /api/v1/admin/moderation/reports/:id/review
exports.reviewReport = async (req, res, next) => {
  try {
    const { resolution, resolutionNote, blockUser, removeContent, issueWarning } = req.body;

    const validResolutions = ['warning_issued', 'content_removed', 'user_banned', 'no_action', 'escalated'];
    if (!validResolutions.includes(resolution)) {
      return next(new AppError(`Resolution must be one of: ${validResolutions.join(', ')}`, 400));
    }

    const report = await Report.findById(req.params.id);
    if (!report) return next(new AppError('Report not found', 404));

    report.status = resolution === 'no_action' ? 'dismissed' : 'resolved';
    report.resolution = resolution;
    report.resolutionNote = resolutionNote || '';
    report.reviewedBy = req.user._id;
    report.reviewedAt = new Date();

    // Take action on the reported user
    if (blockUser && report.reportedUser) {
      const targetUser = await User.findById(report.reportedUser);
      if (targetUser && targetUser.role !== 'admin') {
        targetUser.isBlocked = true;
        targetUser.refreshToken = undefined;
        await targetUser.save();
        report.actionTaken.userBlocked = true;
      }
    }

    // Remove content if applicable
    if (removeContent && report.targetType === 'campaign') {
      const campaign = await Campaign.findById(report.targetId);
      if (campaign) {
        campaign.status = 'cancelled';
        campaign.isFlagged = true;
        campaign.moderationNote = `Removed due to report: ${report.reason}`;
        await campaign.save();
        report.actionTaken.contentRemoved = true;
      }
    }

    if (issueWarning) {
      report.actionTaken.warningIssued = true;
    }

    await report.save();

    await logAudit(req.user, 'report_reviewed', 'report', report._id,
      `Report ${report._id} resolved as: ${resolution}`, req);

    return success(res, { report }, 'Report reviewed successfully');
  } catch (err) {
    next(err);
  }
};

// @desc    Assign report to admin
// @route   PUT /api/v1/admin/moderation/reports/:id/assign
exports.assignReport = async (req, res, next) => {
  try {
    const { adminId } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return next(new AppError('Report not found', 404));

    report.assignedTo = adminId || req.user._id;
    report.status = 'reviewing';
    await report.save();

    return success(res, { report }, 'Report assigned');
  } catch (err) {
    next(err);
  }
};

// @desc    Get moderation stats
// @route   GET /api/v1/admin/moderation/stats
exports.getModerationStats = async (req, res, next) => {
  try {
    const [
      totalReports,
      pendingReports,
      reviewingReports,
      resolvedReports,
      dismissedReports,
      criticalReports,
      flaggedCampaigns,
      blockedUsers,
    ] = await Promise.all([
      Report.countDocuments(),
      Report.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'reviewing' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'dismissed' }),
      Report.countDocuments({ priority: 'critical', status: { $in: ['pending', 'reviewing'] } }),
      Campaign.countDocuments({ isFlagged: true }),
      User.countDocuments({ isBlocked: true }),
    ]);

    // Reports by reason
    const byReason = await Report.aggregate([
      { $group: { _id: '$reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Reports by target type
    const byTargetType = await Report.aggregate([
      { $group: { _id: '$targetType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Reports trend (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyTrend = await Report.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Average resolution time (for resolved reports)
    const avgResolution = await Report.aggregate([
      { $match: { status: 'resolved', reviewedAt: { $ne: null } } },
      {
        $project: {
          resolutionTime: { $subtract: ['$reviewedAt', '$createdAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' },
        },
      },
    ]);

    const avgResolutionHours = avgResolution.length > 0
      ? Math.round(avgResolution[0].avgTime / (1000 * 60 * 60) * 10) / 10
      : 0;

    return success(res, {
      totalReports,
      pendingReports,
      reviewingReports,
      resolvedReports,
      dismissedReports,
      criticalReports,
      flaggedCampaigns,
      blockedUsers,
      byReason,
      byTargetType,
      dailyTrend,
      avgResolutionHours,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Warn a user (create notification + log)
// @route   POST /api/v1/admin/moderation/warn/:userId
exports.warnUser = async (req, res, next) => {
  try {
    const { reason, message } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return next(new AppError('User not found', 404));

    // Create a notification for the user
    const Notification = require('../models/Notification');
    await Notification.create({
      user: user._id,
      type: 'system',
      title: 'Account Warning',
      body: message || `Your account has received a warning for: ${reason}`,
      data: { screen: 'Profile', referenceType: 'warning' },
    });

    await logAudit(req.user, 'warning_issued', 'user', user._id,
      `Warning issued to ${user.name} (${user.email}): ${reason}`, req);

    return success(res, null, 'Warning issued successfully');
  } catch (err) {
    next(err);
  }
};
