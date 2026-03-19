const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { adminLoginRules, createAdminRules } = require('../validators/adminValidator');

// Public — admin login
router.post('/login', validate(adminLoginRules), adminController.adminLogin);

// All routes below require admin role
router.use(protect, authorize('admin'));

// Stats
router.get('/stats', adminController.getStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id/block', adminController.toggleBlockUser);
router.delete('/users/:id', adminController.deleteUser);

// Create new admin
router.post('/create-admin', validate(createAdminRules), adminController.createAdmin);

module.exports = router;
