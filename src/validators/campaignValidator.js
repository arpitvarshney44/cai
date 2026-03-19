const { body, query } = require('express-validator');

exports.createCampaignValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Campaign title is required')
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),
  body('description')
    .trim()
    .notEmpty().withMessage('Campaign description is required')
    .isLength({ max: 3000 }).withMessage('Description cannot exceed 3000 characters'),
  body('niche')
    .optional()
    .isArray().withMessage('Niche must be an array'),
  body('platform')
    .optional()
    .isArray().withMessage('Platform must be an array'),
  body('budget.min')
    .optional()
    .isNumeric().withMessage('Minimum budget must be a number'),
  body('budget.max')
    .optional()
    .isNumeric().withMessage('Maximum budget must be a number'),
  body('timeline.startDate')
    .optional()
    .isISO8601().withMessage('Start date must be a valid date'),
  body('timeline.endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid date'),
  body('status')
    .optional()
    .isIn(['draft', 'active']).withMessage('Status must be draft or active'),
];

exports.updateCampaignValidator = [
  body('title')
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 3000 }).withMessage('Description cannot exceed 3000 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'paused', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid campaign status'),
];

exports.listCampaignsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
];
