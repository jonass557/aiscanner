import Joi from 'joi';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validates the request body/query/params against a Joi schema.
 * Throws ApiError.badRequest if validation fails.
 */
export const validate = (schema) => (req, res, next) => {
  const validationTarget = {
    body: req.body,
    query: req.query,
    params: req.params,
  };

  const { error, value } = schema.validate(validationTarget, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    return next(ApiError.badRequest('Validation failed', details));
  }

  // Replace with validated values
  Object.assign(req, value);
  next();
};

/**
 * Common validation schemas reused across routes.
 */
export const commonSchemas = {
  objectId: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .message('Invalid ID format'),

  email: Joi.string().email().lowercase().trim(),

  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .message('Password must be at least 8 characters with uppercase, lowercase, and number'),

  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  },
};
