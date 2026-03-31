const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { adminLoginRules, createAdminRules } = require('../validators/adminValidator');

const adminDiscoveryController = require('../controllers/adminDiscoveryController');
const adminPaymentController = require('../controllers/adminPaymentController');
const aiController = require('../controllers/aiController');
const moderationController = require('../controllers/moderationController');
const supportController = require('../controllers/supportController');
const settingsController = require('../controllers/settingsController');
const auditController = require('../controllers/auditController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const emailController = require('../controllers/emailController');

// Public — admin login
router.post('/login', validate(adminLoginRules), adminController.adminLogin);

// All routes below require admin role
router.use(protect, authorize('admin'));

// Stats — all admins can see dashboard
router.get('/stats', adminController.getStats);

// Discovery analytics
router.get('/discovery/analytics', requirePermission('analytics_view'), adminDiscoveryController.getDiscoveryAnalytics);

// User management
router.get('/users', requirePermission('users_manage'), adminController.getAllUsers);
router.get('/users/:id', requirePermission('users_manage'), adminController.getUserById);
router.put('/users/:id/block', requirePermission('users_manage'), adminController.toggleBlockUser);
router.put('/users/:id/verify', requirePermission('users_manage'), adminController.toggleVerifyUser);
router.put('/users/:id/profile', requirePermission('users_manage'), adminController.updateUserProfile);
router.get('/users/:id/activity', requirePermission('users_manage'), adminController.getUserActivity);
router.delete('/users/:id', requirePermission('users_delete'), adminController.deleteUser);

// Create new admin — only admins_manage
router.post('/create-admin', requirePermission('admins_manage'), validate(createAdminRules), adminController.createAdmin);

// Campaign management
router.get('/campaigns/stats', requirePermission('campaigns_manage', 'campaigns_moderate'), adminController.getCampaignStats);
router.get('/campaigns', requirePermission('campaigns_manage', 'campaigns_moderate'), adminController.getAllCampaigns);
router.get('/campaigns/:id', requirePermission('campaigns_manage', 'campaigns_moderate'), adminController.getCampaignById);
router.put('/campaigns/:id/moderate', requirePermission('campaigns_moderate'), adminController.moderateCampaign);
router.put('/campaigns/:id/edit', requirePermission('campaigns_manage'), adminController.editCampaignAdmin);

// Application management
router.get('/applications/stats', requirePermission('campaigns_manage', 'campaigns_moderate'), adminController.getApplicationStats);
router.get('/applications', requirePermission('campaigns_manage', 'campaigns_moderate'), adminController.getAllApplications);
router.get('/applications/:id', requirePermission('campaigns_manage', 'campaigns_moderate'), adminController.getApplicationById);
router.put('/applications/:id/override', requirePermission('campaigns_manage'), adminController.overrideApplication);
router.put('/applications/:id/spam', requirePermission('campaigns_moderate'), adminController.toggleSpamApplication);

// Payment & Revenue
router.get('/payments/dashboard', requirePermission('payments_view'), adminPaymentController.getPaymentDashboard);
router.get('/payments/transactions', requirePermission('payments_view'), adminPaymentController.getAllTransactions);
router.get('/payments/subscriptions', requirePermission('payments_view'), adminPaymentController.getSubscriptionAnalytics);
router.get('/payments/commissions', requirePermission('payments_view'), adminPaymentController.getCommissionReport);
router.put('/payments/:id/release', requirePermission('payments_release'), adminPaymentController.releaseEscrow);
router.put('/payments/:id/refund', requirePermission('payments_refund'), adminPaymentController.processRefund);
router.put('/payments/:id/payout', requirePermission('payments_release'), adminPaymentController.processPayout);

// AI Management
router.get('/ai/stats', requirePermission('ai_manage', 'analytics_view'), aiController.getAdminAIStats);
router.get('/ai/features', requirePermission('ai_manage'), aiController.getAIFeatures);
router.put('/ai/features/:id/toggle', requirePermission('ai_manage'), aiController.toggleAIFeature);
router.put('/ai/features/:id/config', requirePermission('ai_manage'), aiController.updateAIFeatureConfig);
router.post('/ai/recalculate-scores', requirePermission('ai_manage'), aiController.recalculateGlobalScores);

// Moderation
router.get('/moderation/stats', requirePermission('moderation_manage'), moderationController.getModerationStats);
router.get('/moderation/reports', requirePermission('moderation_manage'), moderationController.getReports);
router.get('/moderation/reports/:id', requirePermission('moderation_manage'), moderationController.getReportById);
router.put('/moderation/reports/:id/review', requirePermission('moderation_manage'), moderationController.reviewReport);
router.put('/moderation/reports/:id/assign', requirePermission('moderation_manage'), moderationController.assignReport);
router.post('/moderation/warn/:userId', requirePermission('moderation_manage'), moderationController.warnUser);

// Analytics & Reports
router.get('/analytics/overview', requirePermission('analytics_view'), adminAnalyticsController.getAnalyticsOverview);
router.get('/analytics/top-performers', requirePermission('analytics_view'), adminAnalyticsController.getTopPerformers);
router.get('/analytics/export', requirePermission('analytics_view'), adminAnalyticsController.exportAnalytics);

// Settings & Configuration
router.get('/settings', requirePermission('settings_manage'), settingsController.getSettings);
router.put('/settings', requirePermission('settings_manage'), settingsController.updateSettings);
router.put('/settings/feature-flags/:flag', requirePermission('settings_manage'), settingsController.toggleFeatureFlag);
router.put('/settings/maintenance', requirePermission('settings_manage'), settingsController.toggleMaintenance);

// Support & Tickets
router.get('/support/stats', requirePermission('support_manage'), supportController.getTicketStats);
router.get('/support/tickets', requirePermission('support_manage'), supportController.getAllTickets);
router.get('/support/tickets/:id', requirePermission('support_manage'), supportController.getTicketById);
router.post('/support/tickets/:id/respond', requirePermission('support_manage'), supportController.respondToTicket);
router.put('/support/tickets/:id/assign', requirePermission('support_manage'), supportController.assignTicket);
router.put('/support/tickets/:id/status', requirePermission('support_manage'), supportController.updateTicketStatus);
router.put('/support/tickets/:id/resolve', requirePermission('support_manage'), supportController.resolveTicket);
router.put('/support/tickets/:id/close', requirePermission('support_manage'), supportController.closeTicket);

// Audit Logs
router.get('/audit-logs', requirePermission('audit_view'), auditController.getAuditLogs);
router.get('/audit-logs/stats', requirePermission('audit_view'), auditController.getAuditStats);
router.get('/audit-logs/export', requirePermission('audit_view'), auditController.exportAuditLogs);

// Notifications
router.get('/notifications/logs', requirePermission('notifications_send'), adminController.getNotificationLogs);
router.post('/notifications/send', requirePermission('notifications_send'), adminController.sendAnnouncement);

// System Health — all admins can view
router.get('/system/health', adminController.getSystemHealth);

// Admin Role Management — only admins_manage
router.get('/admins', requirePermission('admins_manage'), adminController.getAllAdmins);
router.put('/admins/:id/role', requirePermission('admins_manage'), adminController.updateAdminRole);

// Content & Media
router.get('/media', requirePermission('media_manage'), adminController.getMediaFiles);
router.delete('/media/:filename', requirePermission('media_manage'), adminController.deleteMediaFile);

// Email Management
router.get('/emails/templates', requirePermission('settings_manage'), emailController.getEmailTemplates);
router.put('/emails/templates/:key', requirePermission('settings_manage'), emailController.updateEmailTemplate);
router.get('/emails/preview/:key', requirePermission('settings_manage'), emailController.previewTemplate);
router.post('/emails/send-bulk', requirePermission('notifications_send'), emailController.sendBulkEmail);
router.post('/emails/send-test', requirePermission('settings_manage'), emailController.sendTestEmail);
router.get('/emails/logs', requirePermission('notifications_send'), emailController.getEmailLogs);

module.exports = router;
