import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import config from '../config/index.js';
import { getPlan } from '../config/plans.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateHashedToken,
  hashToken,
  generateOtp,
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
  const { email, password, firstName, lastName, plan: requestedPlan, deviceFingerprint: rawFp, orderId } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) throw ApiError.conflict('Un compte avec cet email existe déjà.');

  let paidOrder = null;
  if (orderId) {
    paidOrder = await Payment.findOne({ externalRef: orderId });
  }

  const isPaidSubscriber = Boolean(paidOrder && (paidOrder.status === 'approved' || paidOrder.amount > 0));

  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '').split(',')[0].trim();
  const deviceFingerprint = (rawFp || '').trim();

  // --- Système Anti-Abus Free Trial (uniquement si l'utilisateur ne souscrit pas à un ordre payé) ---
  if (!isPaidSubscriber) {
    const antiAbuseConditions = [];
    if (deviceFingerprint && deviceFingerprint.length > 6) {
      antiAbuseConditions.push({ deviceFingerprint });
    }
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && !clientIp.startsWith('192.168.') && !clientIp.startsWith('10.')) {
      antiAbuseConditions.push({ registrationIp: clientIp });
    }

    if (antiAbuseConditions.length > 0) {
      const existingTrialUser = await User.findOne({
        $or: antiAbuseConditions,
        $and: [
          {
            $or: [
              { 'trial.isUsed': true },
              { 'trial.isActive': true },
              { 'trial.startedAt': { $ne: null } },
            ],
          },
        ],
      });

      if (existingTrialUser) {
        throw ApiError.forbidden(
          "Cet appareil ou adresse réseau est déjà associé à un compte d'essai gratuit. Un seul compte d'essai est autorisé par appareil."
        );
      }
    }
  }

  // Résolution du plan et initialisation de l'abonnement
  const targetSlug = (paidOrder?.planId || requestedPlan || '1mois').toLowerCase();
  let targetPlan = await Plan.findOne({ id: targetSlug, isActive: true });
  if (!targetPlan) {
    targetPlan = await Plan.findOne({ id: '1mois' }) || await Plan.findOne({ 'trial.enabled': true, isActive: true });
  }

  const trialEnabled = Boolean(targetPlan?.trial?.enabled && !isPaidSubscriber);
  const trialDays = targetPlan?.trial?.days || 7;
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  // Durée de l'abonnement selon le plan (1 mois, 2 mois, 6 mois)
  let subMonths = 1;
  if (targetPlan?.id === '2mois') subMonths = 2;
  else if (targetPlan?.id === '6mois') subMonths = 6;
  else if (targetPlan?.promo?.enabled && targetPlan.promo.durationMonths > 0) subMonths = targetPlan.promo.durationMonths;

  const paidSubEndsAt = new Date();
  paidSubEndsAt.setMonth(paidSubEndsAt.getMonth() + subMonths);

  const { code, hashed } = generateOtp();

  const user = await User.create({
    email: email.toLowerCase().trim(),
    password,
    firstName: firstName || paidOrder?.customerName || '',
    lastName: lastName || '',
    verificationCode: hashed,
    verificationCodeExpires: Date.now() + 15 * 60 * 1000, // 15 minutes
    registrationIp: clientIp,
    deviceFingerprint,
    subscription: {
      plan: targetPlan ? targetPlan.id : '1mois',
      status: 'active',
      startDate: new Date(),
      endDate: isPaidSubscriber ? paidSubEndsAt : trialEndsAt,
      scansPerMonth: -1, // scans illimités pour tous les plans
      scansUsed: 0,
    },
    trial: {
      startedAt: new Date(),
      endsAt: isPaidSubscriber ? null : trialEndsAt,
      days: trialDays,
      appliedFor: targetPlan ? targetPlan.id : '1mois',
      isActive: trialEnabled,
      isUsed: true,
    },
  });

  if (paidOrder) {
    paidOrder.user = user._id;
    if (paidOrder.status !== 'approved') paidOrder.status = 'approved';
    await paidOrder.save();
  }

  // Envoi automatique de l'OTP de vérification par mail
  sendVerificationEmail(user, code).catch(() => {});
  await logAuth('register', {
    message: isPaidSubscriber
      ? `Nouveau compte créé suite au paiement iKeePay (${targetPlan?.name})`
      : 'Nouveau compte créé avec essai gratuit',
    userId: user._id,
    ip: clientIp,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Compte créé avec succès ! Un code de vérification vous a été envoyé par email.',
    data: {
      user,
      accessToken,
      refreshToken,
      requireEmailVerification: true,
    },
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

  if (user.trial?.isActive && user.trial?.endsAt && new Date() > new Date(user.trial.endsAt)) {
    user.trial.isActive = false;
    if (user.subscription.status === 'active') {
      user.subscription.status = 'expired';
    }
    await user.save();
  }

  await logAuth('login', { message: 'User logged in', userId: user._id, ip: req.ip });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return sendSuccess(res, {
    message: 'Logged in successfully.',
    data: { user, accessToken, refreshToken, requireEmailVerification: config.features.requireEmailVerification },
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
 * POST /auth/verify-email  (authenticated)
 * The logged-in user submits the 6-digit OTP they received by email.
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) throw ApiError.badRequest('Verification code is required.');

  const user = req.user;
  if (user.isVerified) {
    return sendSuccess(res, { message: 'Email already verified.', data: { user } });
  }

  if (!user.verificationCode || !user.verificationCodeExpires) {
    throw ApiError.badRequest('No verification code pending. Please request a new one.');
  }
  if (user.verificationCodeExpires.getTime() < Date.now()) {
    throw ApiError.badRequest('This code has expired. Please request a new one.');
  }
  if (user.verificationCode !== hashToken(String(code).trim())) {
    throw ApiError.badRequest('Invalid verification code.');
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  user.verificationToken = undefined;
  await user.save();

  sendWelcomeEmail(user).catch(() => {});
  await logAuth('verify_email', { message: 'Email verified', userId: user._id });

  return sendSuccess(res, { message: 'Email verified successfully.', data: { user } });
});

/**
 * POST /auth/resend-verification  (authenticated)
 * Issues a fresh OTP and emails it.
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.isVerified) throw ApiError.badRequest('Email is already verified.');

  const { code, hashed } = generateOtp();
  user.verificationCode = hashed;
  user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  await user.save();
  // Fire-and-forget so the response is instant; send happens in the background.
  sendVerificationEmail(user, code).catch(() => {});

  return sendSuccess(res, { message: 'A new verification code has been sent to your email.' });
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
    sendPasswordResetEmail(user, token).catch(() => {});
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

  // Surface the effective verification requirement so the client can decide
  // whether to show the "verify your email" gate. Reflects the runtime toggle.
  return sendSuccess(res, {
    data: { user, requireEmailVerification: config.features.requireEmailVerification },
  });
});
