const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { adminLoginRules, createAdminRules } = require('../validators/adminValidator');

const adminDiscoveryController = require('../controllers/adminDiscoveryController');
const adminPaymentController = require('../controllers/adminPaymentController');
const aiController = require('../controllers/aiController');
const moderationController = require('../controllers/moderationController');
const supportController = require('../controllers/supportController');
const settingsController = require('../controllers/settingsController');
const auditController = require('../controllers/auditController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');

// Public — admin login
router.post('/login', validate(adminLoginRules), adminController.adminLogin);

// All routes below require admin role
router.use(protect, authorize('admin'));

// Stats
router.get('/stats', adminController.getStats);

// Discovery analytics
router.get('/discovery/analytics', adminDiscoveryController.getDiscoveryAnalytics);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id/block', adminController.toggleBlockUser);
router.delete('/users/:id', adminController.deleteUser);

// Create new admin
router.post('/create-admin', validate(createAdminRules), adminController.createAdmin);

// Campaign management
router.get('/campaigns/stats', adminController.getCampaignStats);
router.get('/campaigns', adminController.getAllCampaigns);
router.get('/campaigns/:id', adminController.getCampaignById);
router.put('/campaigns/:id/moderate', adminController.moderateCampaign);

// Payment & Revenue
router.get('/payments/dashboard', adminPaymentController.getPaymentDashboard);
router.get('/payments/transactions', adminPaymentController.getAllTransactions);
router.get('/payments/subscriptions', adminPaymentController.getSubscriptionAnalytics);
router.get('/payments/commissions', adminPaymentController.getCommissionReport);

// AI Management
router.get('/ai/stats', aiController.getAdminAIStats);

// Moderation (Task 60)
router.get('/moderation/stats', moderationController.getModerationStats);
router.get('/moderation/reports', moderationController.getReports);
router.get('/moderation/reports/:id', moderationController.getReportById);
router.put('/moderation/reports/:id/review', moderationController.reviewReport);
router.put('/moderation/reports/:id/assign', moderationController.assignReport);
router.post('/moderation/warn/:userId', moderationController.warnUser);

// Analytics & Reports (Task 61)
router.get('/analytics/overview', adminAnalyticsController.getAnalyticsOverview);
router.get('/analytics/export', adminAnalyticsController.exportAnalytics);

// Settings & Configuration (Task 62)
router.get('/settings', settingsController.getSettings);
router.put('/settings', settingsController.updateSettings);
router.put('/settings/feature-flags/:flag', settingsController.toggleFeatureFlag);
router.put('/settings/maintenance', settingsController.toggleMaintenance);

// Support & Tickets (Task 63)
router.get('/support/stats', supportController.getTicketStats);
router.get('/support/tickets', supportController.getAllTickets);
router.get('/support/tickets/:id', supportController.getTicketById);
router.post('/support/tickets/:id/respond', supportController.respondToTicket);
router.put('/support/tickets/:id/assign', supportController.assignTicket);
router.put('/support/tickets/:id/resolve', supportController.resolveTicket);
router.put('/support/tickets/:id/close', supportController.closeTicket);

// Audit Logs (Task 65)
router.get('/audit-logs', auditController.getAuditLogs);
router.get('/audit-logs/stats', auditController.getAuditStats);
router.get('/audit-logs/export', auditController.exportAuditLogs);

module.exports = router;
