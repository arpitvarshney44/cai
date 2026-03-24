const PlatformSettings = require('../models/PlatformSettings');
const AuditLog = require('../models/AuditLog');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

const SETTINGS_KEY = 'global';

// Helper: get or create settings
const getOrCreateSettings = async () => {
  let settings = await PlatformSettings.findOne({ key: SETTINGS_KEY });
  if (!settings) {
    settings = await PlatformSettings.create({ key: SETTINGS_KEY });
  }
  return settings;
};

// @desc    Get platform settings
// @route   GET /api/v1/admin/settings
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    return success(res, { settings });
  } catch (err) {
    next(err);
  }
};

// @desc    Update platform settings
// @route   PUT /api/v1/admin/settings
exports.updateSettings = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const previousData = settings.toObject();

    const allowedFields = [
      'commissionRate', 'minWithdrawal', 'maxWithdrawal',
      'subscriptionPrices', 'featureFlags', 'maintenanceMode',
      'maintenanceMessage', 'emailTemplates', 'notificationSettings', 'rateLimits',
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] === 'object' && !Array.isArray(req.body[field])) {
          // Merge nested objects
          settings[field] = { ...settings[field]?.toObject?.() || settings[field], ...req.body[field] };
        } else {
          settings[field] = req.body[field];
        }
      }
    });

    settings.updatedBy = req.user._id;
    await settings.save();

    await AuditLog.create({
      admin: req.user._id,
      action: 'settings_updated',
      targetType: 'settings',
      description: `Platform settings updated`,
      previousData: { commissionRate: previousData.commissionRate, maintenanceMode: previousData.maintenanceMode },
      newData: { commissionRate: settings.commissionRate, maintenanceMode: settings.maintenanceMode },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, { settings }, 'Settings updated');
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle a feature flag
// @route   PUT /api/v1/admin/settings/feature-flags/:flag
exports.toggleFeatureFlag = async (req, res, next) => {
  try {
    const { flag } = req.params;
    const settings = await getOrCreateSettings();

    if (settings.featureFlags[flag] === undefined) {
      return next(new AppError(`Unknown feature flag: ${flag}`, 400));
    }

    const previous = settings.featureFlags[flag];
    settings.featureFlags[flag] = !previous;
    settings.updatedBy = req.user._id;
    settings.markModified('featureFlags');
    await settings.save();

    await AuditLog.create({
      admin: req.user._id,
      action: 'feature_flag_toggled',
      targetType: 'settings',
      description: `Feature flag "${flag}" toggled from ${previous} to ${!previous}`,
      previousData: { [flag]: previous },
      newData: { [flag]: !previous },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, { flag, enabled: !previous }, `Feature flag "${flag}" ${!previous ? 'enabled' : 'disabled'}`);
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle maintenance mode
// @route   PUT /api/v1/admin/settings/maintenance
exports.toggleMaintenance = async (req, res, next) => {
  try {
    const { message } = req.body;
    const settings = await getOrCreateSettings();

    settings.maintenanceMode = !settings.maintenanceMode;
    if (message) settings.maintenanceMessage = message;
    settings.updatedBy = req.user._id;
    await settings.save();

    await AuditLog.create({
      admin: req.user._id,
      action: 'maintenance_toggled',
      targetType: 'settings',
      description: `Maintenance mode ${settings.maintenanceMode ? 'enabled' : 'disabled'}`,
      severity: 'warning',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return success(res, {
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    }, `Maintenance mode ${settings.maintenanceMode ? 'enabled' : 'disabled'}`);
  } catch (err) {
    next(err);
  }
};
