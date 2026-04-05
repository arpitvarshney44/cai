const { validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    // ── DEBUG LOG ──────────────────────────────────────────────
    console.error('[VALIDATION FAILED]', req.method, req.originalUrl);
    console.error('[REQUEST BODY]', JSON.stringify(req.body, null, 2));
    console.error('[VALIDATION ERRORS]', JSON.stringify(formattedErrors, null, 2));
    // ──────────────────────────────────────────────────────────

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  };
};

module.exports = validate;
