import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

/**
 * General API rate limiter applied to all routes.
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: () => config.isTest,
});

/**
 * Stricter limiter for auth endpoints to slow down brute-force attempts.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  skip: () => config.isTest,
});

/**
 * Limiter for the expensive scan endpoint (AI calls cost money).
 */
export const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Scan rate limit reached, please wait a moment.' },
  skip: () => config.isTest,
});
