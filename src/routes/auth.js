const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const {
  registerRules,
  loginRules,
  verifyEmailRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
  refreshTokenRules,
} = require('../validators/authValidator');

// Public routes
router.post('/register', validate(registerRules), authController.register);
router.post('/login', validate(loginRules), authController.login);
router.post('/forgot-password', validate(forgotPasswordRules), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordRules), authController.resetPassword);
router.post('/refresh-token', validate(refreshTokenRules), authController.refreshToken);

// Protected routes (require login)
router.post('/verify-email', protect, validate(verifyEmailRules), authController.verifyEmail);
router.post('/resend-otp', protect, authController.resendOTP);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);
router.put('/change-password', protect, validate(changePasswordRules), authController.changePassword);

module.exports = router;
