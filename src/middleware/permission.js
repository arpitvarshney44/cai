/**
 * Permission middleware — checks if admin has required permission.
 * Super admins bypass all checks.
 * Usage: router.get('/users', requirePermission('users_manage'), controller)
 */
const { AppError } = require('./errorHandler');

const requirePermission = (...requiredPerms) => {
  return (req, res, next) => {
    // Must be admin
    if (req.user.role !== 'admin') {
      return next(new AppError('Not authorized', 403));
    }

    // Super admin bypasses all permission checks
    // Also: if adminRole is not set (legacy admin), treat as super_admin
    if (!req.user.adminRole || req.user.adminRole === 'super_admin') {
      return next();
    }

    // Check permissions
    const userPerms = req.user.permissions || [];
    const hasPermission = requiredPerms.some(p => userPerms.includes(p));

    if (!hasPermission) {
      return next(new AppError(`Permission denied. Required: ${requiredPerms.join(' or ')}`, 403));
    }

    next();
  };
};

module.exports = { requirePermission };
