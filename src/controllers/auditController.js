const AuditLog = require('../models/AuditLog');
const { success } = require('../utils/apiResponse');

// @desc    Get audit logs with filters & pagination
// @route   GET /api/v1/admin/audit-logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    const {
      action, targetType, severity, adminId, search,
      startDate, endDate,
      page = 1, limit = 50, sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (targetType) filter.targetType = targetType;
    if (severity) filter.severity = severity;
    if (adminId) filter.admin = adminId;
    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('admin', 'name email')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(filter),
    ]);

    return success(res, {
      logs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get audit log stats
// @route   GET /api/v1/admin/audit-logs/stats
exports.getAuditStats = async (req, res, next) => {
  try {
    const [totalLogs, criticalLogs, warningLogs] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ severity: 'critical' }),
      AuditLog.countDocuments({ severity: 'warning' }),
    ]);

    const byAction = await AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]);

    const byAdmin = await AuditLog.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'admin',
          foreignField: '_id',
          as: 'adminInfo',
        },
      },
      { $unwind: '$adminInfo' },
      {
        $group: {
          _id: '$admin',
          name: { $first: '$adminInfo.name' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Daily activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyActivity = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Security alerts (critical severity in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentAlerts = await AuditLog.find({
      severity: { $in: ['critical', 'warning'] },
      createdAt: { $gte: sevenDaysAgo },
    })
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    return success(res, {
      totalLogs,
      criticalLogs,
      warningLogs,
      byAction,
      byAdmin,
      dailyActivity,
      recentAlerts,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Export audit logs (returns JSON for now, CSV can be added)
// @route   GET /api/v1/admin/audit-logs/export
exports.exportAuditLogs = async (req, res, next) => {
  try {
    const { startDate, endDate, action, severity } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (severity) filter.severity = severity;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .limit(5000);

    // CSV format
    const csvHeader = 'Date,Admin,Action,Target Type,Description,Severity,IP Address\n';
    const csvRows = logs.map(l =>
      `"${l.createdAt.toISOString()}","${l.admin?.name || 'N/A'}","${l.action}","${l.targetType}","${(l.description || '').replace(/"/g, '""')}","${l.severity}","${l.ipAddress || 'N/A'}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
    return res.send(csvHeader + csvRows);
  } catch (err) {
    next(err);
  }
};
