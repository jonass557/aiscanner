import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import User from '../models/User.js';
import { getPlan } from '../config/plans.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateHashedToken,
  hashToken,
} from '../services/tokenService.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '../services/emailService.js';
import { logAuth } from '../services/logService.js';

/**
 * POST /auth/register
 * Creates an account, sends a verification email, returns tokens.
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists.');

  const freePlan = getPlan('free');
  const { token, hashed } = generateHashedToken();

  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    verificationToken: hashed,
    subscription: {
      plan: 'free',
      status: 'active',
      scansPerMonth: freePlan.scansPerMonth,
      scansUsed: 0,
    },
  });

  await sendVerificationEmail(user, token);
  await logAuth('register', { message: 'New account created', userId: user._id, ip: req.ip });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created. Please check your email to verify your account.',
    data: { user, accessToken, refreshToken },
  });
});

/**
 * POST /auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    await logAuth('login_failed', { message: `Failed login for ${email}`, ip: req.ip, level: 'warn' });
    throw ApiError.unauthorized('Invalid email or password.');
  }

  await logAuth('login', { message: 'User logged in', userId: user._id, ip: req.ip });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return sendSuccess(res, {
    message: 'Logged in successfully.',
    data: { user, accessToken, refreshToken },
  });
});

/**
 * POST /auth/refresh
 */
export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('Refresh token is required.');

  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findById(decoded.id);
  if (!user) throw ApiError.unauthorized('User no longer exists.');

  return sendSuccess(res, {
    message: 'Token refreshed.',
    data: { accessToken: generateAccessToken(user) },
  });
});

/**
 * POST /auth/verify-email
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw ApiError.badRequest('Verification token is required.');

  const hashed = hashToken(token);
  const user = await User.findOne({ verificationToken: hashed });
  if (!user) throw ApiError.badRequest('Invalid or expired verification token.');

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  await sendWelcomeEmail(user);
  await logAuth('verify_email', { message: 'Email verified', userId: user._id });

  return sendSuccess(res, { message: 'Email verified successfully.', data: { user } });
});

/**
 * POST /auth/resend-verification
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.isVerified) throw ApiError.badRequest('Email is already verified.');

  const { token, hashed } = generateHashedToken();
  user.verificationToken = hashed;
  await user.save();
  await sendVerificationEmail(user, token);

  return sendSuccess(res, { message: 'Verification email sent.' });
});

/**
 * POST /auth/forgot-password
 * Always returns success to avoid leaking which emails are registered.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    const { token, hashed } = generateHashedToken();
    user.resetPasswordToken = hashed;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();
    await sendPasswordResetEmail(user, token);
    await logAuth('forgot_password', { message: 'Password reset requested', userId: user._id, ip: req.ip });
  }

  return sendSuccess(res, {
    message: 'If an account exists for that email, a reset link has been sent.',
  });
});

/**
 * POST /auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw ApiError.badRequest('Token and new password are required.');

  const hashed = hashToken(token);
  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) throw ApiError.badRequest('Invalid or expired reset token.');

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  await logAuth('reset_password', { message: 'Password reset', userId: user._id, ip: req.ip });

  return sendSuccess(res, { message: 'Password reset successfully. You can now log in.' });
});

/**
 * GET /auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  // Re-fetch to trigger monthly reset check and return fresh data.
  const user = await User.findById(req.user._id);
  user.checkAndResetMonthlyScans();
  await user.save();

  return sendSuccess(res, { data: { user } });
});
