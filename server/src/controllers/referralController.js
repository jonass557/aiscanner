import User from '../models/User.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Get current user's referral info and statistics
 */
export const getMyReferral = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('Utilisateur introuvable');

  // Ensure referral code exists
  if (!user.referralCode) {
    user.referralCode = (user.firstName ? user.firstName.slice(0, 3).toUpperCase() : 'TRD') + Math.random().toString(36).substring(2, 6).toUpperCase();
    await user.save();
  }

  const enabled = Boolean(user.referral?.enabled);
  const commissionRate = user.referral?.commissionRate || 20;
  const balance = user.referral?.balance || 0;
  const totalEarned = user.referral?.totalEarned || 0;
  const totalWithdrawn = user.referral?.totalWithdrawn || 0;

  // Counts
  const totalReferred = await User.countDocuments({ referredBy: user._id });
  const activeSubscribed = await User.countDocuments({
    referredBy: user._id,
    'subscription.status': 'active',
    'subscription.plan': { $nin: ['free', null] },
  });

  const withdrawals = await WithdrawalRequest.find({ user: user._id })
    .sort({ createdAt: -1 })
    .limit(20);

  return sendSuccess(res, {
    message: 'Données de parrainage récupérées.',
    data: {
      enabled,
      referralCode: user.referralCode,
      commissionRate,
      balance,
      totalEarned,
      totalWithdrawn,
      totalReferred,
      activeSubscribed,
      withdrawals,
    },
  });
});

/**
 * User submits a Mobile Money withdrawal request
 */
export const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, method, phone, accountHolder } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) throw ApiError.notFound('Utilisateur introuvable');
  if (!user.referral?.enabled) {
    throw ApiError.forbidden("Le programme de parrainage n'est pas encore activé sur votre compte.");
  }

  const withdrawAmount = Number(amount);
  if (!withdrawAmount || withdrawAmount < 500) {
    throw ApiError.badRequest('Le montant minimum de retrait est de 500 FCFA.');
  }

  const currentBalance = user.referral?.balance || 0;
  if (withdrawAmount > currentBalance) {
    throw ApiError.badRequest(`Solde insuffisant. Votre solde disponible est de ${currentBalance.toLocaleString()} FCFA.`);
  }

  if (!method || !['mtn_mobile_money', 'orange_money'].includes(method)) {
    throw ApiError.badRequest('Moyen de retrait invalide. Choisissez MTN Mobile Money ou Orange Money.');
  }

  if (!phone || String(phone).trim().length < 8) {
    throw ApiError.badRequest('Veuillez renseigner un numéro de téléphone Mobile Money valide.');
  }

  if (!accountHolder || String(accountHolder).trim().length < 3) {
    throw ApiError.badRequest('Veuillez renseigner le nom complet du titulaire du compte.');
  }

  // Deduct from available balance immediately to prevent double spending
  user.referral.balance = currentBalance - withdrawAmount;
  await user.save();

  const withdrawal = await WithdrawalRequest.create({
    user: user._id,
    amount: withdrawAmount,
    method,
    phone: String(phone).trim(),
    accountHolder: String(accountHolder).trim(),
    status: 'pending',
  });

  return sendSuccess(res, {
    message: 'Demande de retrait enregistrée avec succès. Elle sera traitée par l’administrateur sous peu.',
    data: {
      withdrawal,
      remainingBalance: user.referral.balance,
    },
  });
});

/**
 * ADMIN: Get all withdrawal requests
 */
export const adminGetWithdrawals = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const filter = {};
  if (status && status !== 'all') {
    filter.status = status;
  }

  const withdrawals = await WithdrawalRequest.find(filter)
    .populate('user', 'firstName lastName email referral')
    .populate('processedBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(100);

  return sendSuccess(res, {
    message: 'Demandes de retrait.',
    data: { withdrawals },
  });
});

/**
 * ADMIN: Approve or Reject a withdrawal request
 */
export const adminProcessWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body; // action: 'approve' | 'reject'

  const withdrawal = await WithdrawalRequest.findById(id).populate('user');
  if (!withdrawal) throw ApiError.notFound('Demande de retrait introuvable.');

  if (withdrawal.status !== 'pending') {
    throw ApiError.badRequest(`Cette demande a déjà été traitée (${withdrawal.status}).`);
  }

  const user = withdrawal.user;

  if (action === 'approve') {
    withdrawal.status = 'approved';
    withdrawal.adminNote = note || 'Retrait validé et transféré avec succès.';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    await withdrawal.save();

    if (user) {
      user.referral.totalWithdrawn = (user.referral.totalWithdrawn || 0) + withdrawal.amount;
      await user.save();
    }
  } else if (action === 'reject') {
    withdrawal.status = 'rejected';
    withdrawal.adminNote = note || 'Demande de retrait refusée.';
    withdrawal.processedAt = new Date();
    withdrawal.processedBy = req.user._id;
    await withdrawal.save();

    // Refund amount back to user's balance
    if (user) {
      user.referral.balance = (user.referral.balance || 0) + withdrawal.amount;
      await user.save();
    }
  } else {
    throw ApiError.badRequest("Action invalide. Utilisez 'approve' ou 'reject'.");
  }

  return sendSuccess(res, {
    message: `Demande de retrait ${action === 'approve' ? 'approuvée' : 'rejetée'}.`,
    data: { withdrawal },
  });
});

/**
 * ADMIN: Toggle referral status and commission rate for a user
 */
export const adminUpdateUserReferral = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { enabled, commissionRate } = req.body;

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Utilisateur introuvable.');

  if (!user.referral) {
    user.referral = { enabled: false, commissionRate: 20, balance: 0, totalEarned: 0, totalWithdrawn: 0 };
  }

  if (typeof enabled === 'boolean') {
    user.referral.enabled = enabled;
  }

  if (commissionRate !== undefined && !isNaN(commissionRate)) {
    user.referral.commissionRate = Math.max(1, Math.min(100, Number(commissionRate)));
  }

  if (!user.referralCode) {
    user.referralCode = (user.firstName ? user.firstName.slice(0, 3).toUpperCase() : 'TRD') + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  await user.save();

  return sendSuccess(res, {
    message: `Parrainage ${user.referral.enabled ? 'activé' : 'désactivé'} pour cet utilisateur.`,
    data: {
      userId: user._id,
      referral: user.referral,
      referralCode: user.referralCode,
    },
  });
});
