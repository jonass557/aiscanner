import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';

/**
 * JWT + random-token helpers used by the auth flow.
 */

export const generateAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });

export const generateRefreshToken = (user) =>
  jwt.sign({ id: user._id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpire,
  });

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.secret);

export const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

/**
 * Generates a random token and its SHA-256 hash. The plain token goes in the
 * email link; only the hash is stored in the DB (so a DB leak can't be used
 * to reset accounts).
 */
export const generateHashedToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hashed };
};

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
