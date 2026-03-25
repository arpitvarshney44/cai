const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const generateOTP = require('../utils/generateOTP');
const sendEmail = require('../utils/sendEmail');
const emailTemplates = require('../utils/emailTemplates');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

// @desc    Register a new user
// @route   POST /api/v1/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already registered', 400));
    }

    const user = await User.create({ name, email, password, role });

    // Generate OTP for email verification
    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    // Send verification email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Connect.AI - Verify Your Email',
        html: emailTemplates.verificationOTP(user.name, otp.code),
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    return success(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isProfileComplete: user.isProfileComplete,
      },
      accessToken,
      refreshToken,
    }, 'Registration successful. Please verify your email.', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(new AppError('Invalid email or password', 401));
    }

    if (user.isBlocked) {
      return next(new AppError('Your account has been blocked. Contact support.', 403));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401));
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    return success(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        isProfileComplete: user.isProfileComplete,
        avatar: user.avatar,
      },
      accessToken,
      refreshToken,
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email with OTP
// @route   POST /api/v1/auth/verify-email
exports.verifyEmail = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);

    if (user.isVerified) {
      return next(new AppError('Email already verified', 400));
    }

    if (!user.otp || !user.otp.code) {
      return next(new AppError('No OTP found. Please request a new one.', 400));
    }

    if (new Date() > user.otp.expiresAt) {
      return next(new AppError('OTP has expired. Please request a new one.', 400));
    }

    if (user.otp.code !== otp) {
      return next(new AppError('Invalid OTP', 400));
    }

    user.isVerified = true;
    user.otp = undefined;
    await user.save();

    return success(res, null, 'Email verified successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Resend OTP
// @route   POST /api/v1/auth/resend-otp
exports.resendOTP = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.isVerified) {
      return next(new AppError('Email already verified', 400));
    }

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: 'Connect.AI - New Verification Code',
        html: emailTemplates.resendOTP(user.name, otp.code),
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return success(res, null, 'New OTP sent to your email');
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password - send OTP
// @route   POST /api/v1/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('No account found with this email', 404));
    }

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: 'Connect.AI - Password Reset Code',
        html: emailTemplates.passwordReset(user.name, otp.code),
      });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    return success(res, null, 'Password reset code sent to your email');
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password with OTP
// @route   POST /api/v1/auth/reset-password
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('No account found with this email', 404));
    }

    if (!user.otp || !user.otp.code) {
      return next(new AppError('No reset code found. Please request a new one.', 400));
    }

    if (new Date() > user.otp.expiresAt) {
      return next(new AppError('Reset code has expired. Please request a new one.', 400));
    }

    if (user.otp.code !== otp) {
      return next(new AppError('Invalid reset code', 400));
    }

    user.password = newPassword;
    user.otp = undefined;
    await user.save();

    return success(res, null, 'Password reset successful. Please login with your new password.');
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh-token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      return next(new AppError('Invalid refresh token', 401));
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    return success(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    }, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/v1/auth/logout
exports.logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    user.refreshToken = undefined;
    await user.save();

    return success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/v1/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    return success(res, {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        isVerified: user.isVerified,
        isProfileComplete: user.isProfileComplete,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password (logged in user)
// @route   PUT /api/v1/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect', 400));
    }

    user.password = newPassword;
    await user.save();

    return success(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};
