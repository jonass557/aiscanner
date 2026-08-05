import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/tokenService.js';
import User from '../models/User.js';
import config from '../config/index.js';

/**
 * Auth guard. Extracts the Bearer token, verifies it, loads the user, and
 * attaches it to req.user. Throws 401 on any failure.
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    throw ApiError.unauthorized('Not authenticated. Please log in.');
  }

  const decoded = verifyAccessToken(token);
  const user = await User.findById(decoded.id);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists.');
  }

  req.user = user;
  next();
});

/**
 * Role guard. Use after `protect`. Restricts access to given roles.
 */
export const authorize = (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action.'));
    }
    next();
  };

/**
 * Requires a verified email. Use after `protect` on sensitive actions.
 * No-op when email verification is disabled (config.features.requireEmailVerification),
 * so the product works without an email provider configured.
 */
export const requireVerified = (req, res, next) => {
  if (!config.features.requireEmailVerification) return next();
  if (!req.user?.isVerified) {
    return next(ApiError.forbidden('Please verify your email to continue.'));
  }
  next();
};
