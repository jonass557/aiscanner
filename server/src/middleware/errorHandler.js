import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { error as errorResponse } from '../utils/response.js';
import logger from '../config/logger.js';
import config from '../config/index.js';

/**
 * Converts any thrown value into an ApiError so the handler below
 * always works with a consistent shape.
 */
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Mongoose bad ObjectId
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // Mongoose validation
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiError.badRequest('Validation failed', details);
  }

  // Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return ApiError.conflict(`${field} already exists`);
  }

  // JWT
  if (err.name === 'JsonWebTokenError') {
    return ApiError.unauthorized('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Token expired');
  }

  // Multer file-size
  if (err.code === 'LIMIT_FILE_SIZE') {
    return ApiError.badRequest('File too large');
  }

  const statusCode = err.statusCode || 500;
  const apiError = new ApiError(statusCode, err.message || 'Internal server error');
  apiError.isOperational = false;
  return apiError;
};

/**
 * Global error handler. Must be registered last.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const apiError = normalizeError(err);

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${apiError.message}`, {
      stack: err.stack,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${apiError.message}`);
  }

  const payload = {
    statusCode: apiError.statusCode,
    message: apiError.message,
    details: apiError.details,
  };

  // Only leak stack traces outside production.
  if (!config.isProduction && apiError.statusCode >= 500) {
    payload.stack = err.stack;
  }

  return errorResponse(res, payload.statusCode, payload.message, payload.details, payload.stack);
};

/**
 * 404 handler for unmatched routes.
 */
export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
