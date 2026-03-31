const User = require('../models/User');
const EmailLog = require('../models/EmailLog');
const PlatformSettings = require('../models/PlatformSettings');
const sendEmail = require('../utils/sendEmail');
const templates = require('../utils/emailTemplates');
const AuditLog = require('../models/AuditLog');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

// @desc    Get email templates (from PlatformSettings)
// @route   GET /api/v1/admin/emails/templates
exports.getEmailTemplates = async (req, res, next) => {
  try {
    let settings = await PlatformSettings.findOne({ key: 'global' });
    if (!settings) settings = await PlatformSettings.create({ key: 'global' });
    return success(res, { templates: settings.emailTemplates || {} });
  } catch (err) { next(err); }
};

// @desc    Update email template
// @route   PUT /api/v1/admin/emails/templates/:key
exports.updateEmailTemplate = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { subject, enabled, body } = req.body;
    let settings = await PlatformSettings.findOne({ key: 'global' });
    if (!settings) settings = await PlatformSettings.create({ key: 'global' });

    if (!settings.emailTemplates[key]) {
      return next(new AppError(`Template "${key}" not found`, 404));
    }
    if (subject !== undefined) settings.emailTemplates[key].subject = subject;
    if (enabled !== undefined) settings.emailTemplates[key].enabled = enabled;
    if (body !== undefined) settings.emailTemplates[key].body = body;
    settings.updatedBy = req.user._id;
    settings.markModified('emailTemplates');
    await settings.save();

    return success(res, { template: settings.emailTemplates[key] }, 'Template updated');
  } catch (err) { next(err); }
};

// @desc    Send bulk email
// @route   POST /api/v1/admin/emails/send-bulk
exports.sendBulkEmail = async (req, res, next) => {
  try {
    const { subject, message, targetRole, targetUserIds } = req.body;
    if (!subject || !message) return next(new AppError('Subject and message required', 400));

    let userFilter = { role: { $ne: 'admin' } };
    if (targetRole) userFilter.role = targetRole;
    if (targetUserIds?.length) userFilter = { _id: { $in: targetUserIds } };

    const users = await User.find(userFilter).select('name email').lean();
    if (users.length === 0) return next(new AppError('No users found', 404));

    const bulkId = `bulk_${Date.now()}`;
    let sentCount = 0;
    let failedCount = 0;

    // Send emails in batches of 10
    for (let i = 0; i < users.length; i += 10) {
      const batch = users.slice(i, i + 10);
      await Promise.allSettled(batch.map(async (user) => {
        try {
          const html = templates.genericNotification(user.name, subject, message);
          await sendEmail({ to: user.email, subject, html });
          await EmailLog.create({
            to: user.email, subject, template: 'bulk', status: 'sent',
            sentBy: req.user._id, bulkId, metadata: { userName: user.name },
          });
          sentCount++;
        } catch (err) {
          await EmailLog.create({
            to: user.email, subject, template: 'bulk', status: 'failed',
            error: err.message, sentBy: req.user._id, bulkId,
          });
          failedCount++;
        }
      }));
    }

    await AuditLog.create({
      admin: req.user._id, action: 'bulk_action', targetType: 'system',
      description: `Bulk email "${subject}" — ${sentCount} sent, ${failedCount} failed`,
      severity: failedCount > 0 ? 'warning' : 'info',
    });

    return success(res, { sent: sentCount, failed: failedCount, total: users.length, bulkId });
  } catch (err) { next(err); }
};

// @desc    Send test email
// @route   POST /api/v1/admin/emails/send-test
exports.sendTestEmail = async (req, res, next) => {
  try {
    const { to, template } = req.body;
    if (!to) return next(new AppError('Email address required', 400));

    let subject = 'Test Email from ConnectAI';
    let html = '';

    switch (template) {
      case 'verification':
        subject = 'Test: Verify your email';
        html = templates.verificationOTP('Test User', '123456');
        break;
      case 'passwordReset':
        subject = 'Test: Reset your password';
        html = templates.passwordReset('Test User', '654321');
        break;
      default:
        html = templates.genericNotification('Test User', 'Test Email', 'This is a test email from ConnectAI admin panel.');
    }

    await sendEmail({ to, subject, html });
    await EmailLog.create({ to, subject, template: template || 'test', status: 'sent', sentBy: req.user._id });

    return success(res, null, 'Test email sent');
  } catch (err) {
    await EmailLog.create({ to: req.body.to, subject: 'Test', template: 'test', status: 'failed', error: err.message, sentBy: req.user._id });
    next(err);
  }
};

// @desc    Get email delivery logs
// @route   GET /api/v1/admin/emails/logs
exports.getEmailLogs = async (req, res, next) => {
  try {
    const { status, template, page = 1, limit = 30 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (template) filter.template = template;
    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total, stats] = await Promise.all([
      EmailLog.find(filter).populate('sentBy', 'name').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      EmailLog.countDocuments(filter),
      EmailLog.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const totalSent = stats.find(s => s._id === 'sent')?.count || 0;
    const totalFailed = stats.find(s => s._id === 'failed')?.count || 0;

    return success(res, {
      logs, stats: { totalSent, totalFailed, total: totalSent + totalFailed },
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

// @desc    Preview email template HTML
// @route   GET /api/v1/admin/emails/preview/:key
exports.previewTemplate = async (req, res, next) => {
  try {
    const { key } = req.params;
    const TEMPLATE_MAP = templates.TEMPLATE_MAP;

    // Check if admin has custom body saved in DB
    const settings = await PlatformSettings.findOne({ key: 'global' });
    const customBody = settings?.emailTemplates?.[key]?.body;

    if (customBody) {
      // Wrap custom body in base layout
      const baseLayout = templates.baseLayout || ((c) => c);
      // Use the raw custom HTML with variable placeholders replaced
      const html = customBody
        .replace(/\{\{name\}\}/g, 'Preview User')
        .replace(/\{\{code\}\}/g, '123456')
        .replace(/\{\{amount\}\}/g, '25,000')
        .replace(/\{\{campaignTitle\}\}/g, 'Sample Campaign');
      return res.send(html);
    }

    // Fallback to hardcoded template
    if (!TEMPLATE_MAP[key]) return next(new AppError(`Template "${key}" not found`, 404));
    const html = TEMPLATE_MAP[key]('Preview User');
    return res.send(html);
  } catch (err) { next(err); }
};
