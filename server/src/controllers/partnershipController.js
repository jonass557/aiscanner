import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import PartnershipConfig from '../models/PartnershipConfig.js';
import PartnerCommission from '../models/PartnerCommission.js';
import PayoutTransaction from '../models/PayoutTransaction.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import * as settingsService from '../services/settings/settingsService.js';
import { IKEEPAY_H2H_COUNTRIES } from '../services/payments/index.js';
import { generateAccessToken, generateRefreshToken } from '../services/tokenService.js';
import { logAdmin, logAuth } from '../services/logService.js';
import { sendAdminPartnershipNotification } from '../services/emailService.js';
import {
  getOrCreatePartnershipConfig,
  getConfiguredIkeepayProvider,
  countActivePartners,
  activatePartnershipForUser,
  releaseDueScheduledCommissions,
  isPartnerInactiveMonthly,
} from '../services/partnershipService.js';

/**
 * GET /api/v1/partnership/config  (PUBLIC)
 * Returns public partnership program offer, remaining spots, terms, and supported H2H countries.
 */
export const getPublicPartnershipConfig = asyncHandler(async (req, res) => {
  const cfg = await getOrCreatePartnershipConfig();
  const activePartnersCount = await countActivePartners();
  const maxPartners = Math.max(1, Number(cfg.maxPartners || 50));
  const spotsRemaining = Math.max(0, maxPartners - activePartnersCount);

  return sendSuccess(res, {
    data: {
      isEnabled: Boolean(cfg.isEnabled && !cfg.isDeleted),
      isDeleted: Boolean(cfg.isDeleted),
      title: cfg.title,
      subtitle: cfg.subtitle,
      badgeText: cfg.badgeText,
      price: cfg.price,
      currency: cfg.currency || 'XOF',
      maxPartners,
      activePartnersCount,
      spotsRemaining,
      commissionRate: cfg.commissionRate || 30,
      adminShareRate: 100 - (cfg.commissionRate || 30),
      creditTiming: cfg.creditTiming || 'instant',
      benefits: cfg.benefits || [],
      termsAndConditions: cfg.termsAndConditions || '',
      h2hCountries: IKEEPAY_H2H_COUNTRIES,
    },
  });
});

/**
 * POST /api/v1/partnership/pay  (PUBLIC or AUTH via optionalAuth)
 * Initiates iKeePay H2H payin for joining the Partnership Program.
 */
export const initiatePartnershipPayment = asyncHandler(async (req, res) => {
  const cfg = await getOrCreatePartnershipConfig();
  if (cfg.isDeleted || !cfg.isEnabled) {
    throw ApiError.badRequest("Le programme de partenariat n'est pas disponible actuellement.");
  }

  const activePartnersCount = await countActivePartners();
  if (activePartnersCount >= cfg.maxPartners) {
    throw ApiError.badRequest('Toutes les places du programme de partenariat sont actuellement complètes.');
  }

  if (req.user?.partnership?.isActive && req.user?.partnership?.status === 'active') {
    throw ApiError.badRequest('Votre compte dispose déjà d’un statut Partenaire VIP actif.');
  }

  const { email, phoneNumber, country = 'CI', operator = 'ORANGE', otp, fullName, acceptedTerms } = req.body;
  if (!acceptedTerms) {
    throw ApiError.badRequest('Veuillez lire et accepter les termes et conditions du partenariat.');
  }

  const cleanEmail = String(req.user?.email || email || '').toLowerCase().trim();
  if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw ApiError.badRequest('Une adresse email valide est requise.');
  }

  const activeProvider = settingsService.getValue('payments.provider') || config.payments.provider || 'ikeepay';
  const amount = Math.max(0, Number(cfg.price || 50000));
  const currency = cfg.currency || 'XOF';
  const orderId = `PART_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // Free partnership edge case
  if (amount <= 0) {
    const payment = await Payment.create({
      user: req.user?._id || null,
      customerEmail: cleanEmail,
      customerName: fullName || (req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : ''),
      customerPhone: String(phoneNumber || '').trim(),
      planId: 'partner_lifetime',
      amount: 0,
      currency,
      type: 'payin',
      purpose: 'partnership',
      country: String(country || 'CI').toUpperCase(),
      operator: String(operator || 'ORANGE').toUpperCase(),
      provider: activeProvider,
      externalRef: orderId,
      method: 'h2h_payin',
      status: 'approved',
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Accès partenariat prêt — complétez le formulaire final.',
      data: {
        orderId,
        status: 'approved',
        amount: 0,
        currency,
        paymentId: payment._id,
      },
    });
  }

  // Demo mode fallback if explicitly enabled without iKeePay keys
  const provider = getConfiguredIkeepayProvider();
  if (!provider.isConfigured()) {
    if (activeProvider === 'demo') {
      const payment = await Payment.create({
        user: req.user?._id || null,
        customerEmail: cleanEmail,
        customerName: fullName || '',
        customerPhone: String(phoneNumber || '').trim(),
        planId: 'partner_lifetime',
        amount,
        currency,
        type: 'payin',
        purpose: 'partnership',
        country: String(country || 'CI').toUpperCase(),
        operator: String(operator || 'ORANGE').toUpperCase(),
        provider: 'demo',
        externalRef: orderId,
        providerRef: `DEMO_${orderId}`,
        method: 'demo',
        status: 'approved',
      });

      return sendSuccess(res, {
        statusCode: 201,
        message: 'Paiement approuvé (mode démo). Remplissez maintenant le formulaire partenaire.',
        data: { orderId, status: 'approved', amount, currency, paymentId: payment._id },
      });
    }
    throw ApiError.badRequest("La clé secrète iKeePay H2H (x-api-key) n'est pas encore configurée par l'administrateur.");
  }

  const h2hRes = await provider.initiatePayin({
    amount,
    currency,
    country,
    phoneNumber,
    operator,
    external_reference: orderId,
    customer_email: cleanEmail,
    otp,
  });

  const payment = await Payment.create({
    user: req.user?._id || null,
    customerEmail: cleanEmail,
    customerName: fullName || '',
    customerPhone: String(phoneNumber || '').trim(),
    planId: 'partner_lifetime',
    amount,
    currency,
    type: 'payin',
    purpose: 'partnership',
    country: String(country || 'CI').toUpperCase(),
    operator: String(operator || 'ORANGE').toUpperCase(),
    provider: 'ikeepay',
    providerRef: h2hRes.providerRef || undefined,
    externalRef: orderId,
    paymentLink: h2hRes.paymentLink || '',
    checkoutUrl: h2hRes.paymentLink || '',
    method: 'h2h_payin',
    status: h2hRes.status === 'approved' ? 'approved' : h2hRes.status === 'rejected' ? 'rejected' : 'pending',
    rawResponse: h2hRes.raw,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: payment.status === 'approved'
      ? 'Paiement validé ! Veuillez compléter le formulaire Partenaire.'
      : h2hRes.paymentLink
      ? 'Lien de paiement généré. Finalisez votre paiement sur le portail sécurisé.'
      : 'Paiement Mobile Money initié. Validez la notification sur votre téléphone.',
    data: {
      paymentId: payment._id,
      orderId,
      providerRef: h2hRes.providerRef || null,
      status: payment.status,
      paymentLink: h2hRes.paymentLink || '',
      amount,
      currency,
      country: payment.country,
      operator: payment.operator,
    },
  });
});

/**
 * POST /api/v1/partnership/verify-payment  (PUBLIC or AUTH via optionalAuth)
 * Checks transaction status via iKeePay H2H GET /h2h-verify/:reference.
 */
export const verifyPartnershipPayment = asyncHandler(async (req, res) => {
  const { orderId, providerRef } = req.body;
  if (!orderId && !providerRef) {
    throw ApiError.badRequest('Référence de transaction requise.');
  }

  const payment = orderId
    ? await Payment.findOne({ externalRef: orderId, purpose: 'partnership' })
    : await Payment.findOne({ providerRef, purpose: 'partnership' });

  if (!payment) throw ApiError.notFound('Transaction partenariat introuvable.');

  if (payment.status === 'approved') {
    return sendSuccess(res, {
      message: 'Paiement confirmé ! Complétez le formulaire pour activer votre espace Partenaire.',
      data: {
        status: 'approved',
        orderId: payment.externalRef,
        providerRef: payment.providerRef,
        email: payment.customerEmail,
      },
    });
  }

  const provider = getConfiguredIkeepayProvider();
  const checkRef = payment.externalRef || payment.providerRef;
  const verification = await provider.verifyTransaction(checkRef);

  if (verification.providerRef && !payment.providerRef) {
    payment.providerRef = verification.providerRef;
  }

  if (verification.valid || verification.status === 'approved') {
    payment.status = 'approved';
    await payment.save();
  } else if (verification.status === 'rejected') {
    payment.status = 'rejected';
    await payment.save();
  }

  return sendSuccess(res, {
    message: payment.status === 'approved'
      ? 'Paiement validé ! Complétez votre formulaire Partenaire.'
      : payment.status === 'rejected'
      ? 'Le paiement a été refusé ou annulé.'
      : 'Paiement toujours en attente de confirmation...',
    data: {
      status: payment.status,
      orderId: payment.externalRef,
      providerRef: payment.providerRef,
      email: payment.customerEmail,
    },
  });
});

/**
 * POST /api/v1/partnership/complete-registration  (PUBLIC or AUTH via optionalAuth)
 * Step 3 after payment: User submits Full Name, Email, Phone (+ optional Password if brand new).
 * Immediately grants lifetime partner advantages & dispatches form details to Admin.
 */
export const completePartnershipRegistration = asyncHandler(async (req, res) => {
  const { orderId, fullName, email, phone, password } = req.body;

  if (!orderId) throw ApiError.badRequest('Référence de paiement requise.');
  if (!fullName || String(fullName).trim().length < 2) {
    throw ApiError.badRequest('Votre nom complet est requis.');
  }
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw ApiError.badRequest('Une adresse email valide est requise.');
  }
  const cleanPhone = String(phone || '').trim();
  if (!cleanPhone || cleanPhone.length < 8) {
    throw ApiError.badRequest('Un numéro de téléphone valide est requis.');
  }

  const payment = await Payment.findOne({ externalRef: orderId, purpose: 'partnership' });
  if (!payment) throw ApiError.notFound('Paiement partenariat introuvable.');

  // Double-check against H2H verify if webhook hasn't arrived yet
  if (payment.status !== 'approved') {
    const provider = getConfiguredIkeepayProvider();
    const verification = await provider.verifyTransaction(payment.externalRef || payment.providerRef);
    if (verification.valid || verification.status === 'approved') {
      payment.status = 'approved';
      if (verification.providerRef) payment.providerRef = verification.providerRef;
      await payment.save();
    } else {
      throw ApiError.badRequest("Votre paiement n'est pas encore confirmé comme terminé. Veuillez valider le paiement Mobile Money d'abord.");
    }
  }

  // Resolve target user: currently logged-in user OR existing account by email OR create new user
  let targetUser = null;
  if (req.user) {
    targetUser = await User.findById(req.user._id);
  }
  if (!targetUser) {
    targetUser = await User.findOne({ email: cleanEmail });
  }

  let isNewAccount = false;
  let needsLogin = false;

  if (targetUser) {
    // Existing user (even with active subscription) gets upgraded immediately!
    if (targetUser.partnership?.formSubmitted && targetUser.partnership?.paymentRef === payment.externalRef) {
      // Idempotent retry
      const isSameLoggedIn = req.user && String(req.user._id) === String(targetUser._id);
      return sendSuccess(res, {
        message: 'Votre statut Partenaire VIP est déjà actif !',
        data: {
          user: isSameLoggedIn ? targetUser : undefined,
          authenticated: Boolean(isSameLoggedIn),
          needsLogin: !isSameLoggedIn,
          email: targetUser.email,
        },
      });
    }

    await activatePartnershipForUser(targetUser, {
      fullName,
      email: cleanEmail,
      phone: cleanPhone,
      paymentRef: payment.externalRef,
      paidAmount: payment.amount,
    });

    if (!req.user || String(req.user._id) !== String(targetUser._id)) {
      needsLogin = true;
    }
  } else {
    // Brand new visitor -> requires password or create account directly
    if (!password || String(password).length < 8) {
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Choisissez un mot de passe (min. 8 caractères) pour créer votre espace Partenaire.',
        data: { requiresPassword: true },
      });
    }

    const parts = String(fullName).trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    targetUser = await User.create({
      email: cleanEmail,
      password: String(password),
      firstName,
      lastName,
      phone: cleanPhone.replace(/[^\d+]/g, ''),
      isVerified: true,
      subscription: {
        plan: 'partner_lifetime',
        status: 'active',
        startDate: new Date(),
        scansPerMonth: -1,
        scansUsed: 0,
      },
    });

    await activatePartnershipForUser(targetUser, {
      fullName,
      email: cleanEmail,
      phone: cleanPhone,
      paymentRef: payment.externalRef,
      paidAmount: payment.amount,
    });

    isNewAccount = true;
  }

  payment.user = targetUser._id;
  payment.customerName = String(fullName).trim();
  payment.customerPhone = cleanPhone;
  payment.customerEmail = cleanEmail;
  await payment.save();

  await logAuth('partnership_joined', {
    message: `🤝 Nouveau Partenaire VIP : ${fullName} (${cleanEmail}, Tél: ${cleanPhone}) — Réf ${payment.externalRef}`,
    userId: targetUser._id,
    ip: req.ip,
    metadata: {
      fullName,
      email: cleanEmail,
      phone: cleanPhone,
      paymentRef: payment.externalRef,
      amount: payment.amount,
      currency: payment.currency,
    },
  });

  // Notify admin by email asynchronously
  sendAdminPartnershipNotification({
    fullName,
    email: cleanEmail,
    phone: cleanPhone,
    paymentRef: payment.externalRef,
    amount: payment.amount,
    currency: payment.currency,
  }).catch((err) => logger.warn(`Partnership admin notification email failed: ${err.message}`));

  const payload = {
    authenticated: isNewAccount || Boolean(req.user && String(req.user._id) === String(targetUser._id)),
    needsLogin,
    isNewAccount,
    email: targetUser.email,
    user: targetUser,
  };

  if (isNewAccount) {
    payload.accessToken = generateAccessToken(targetUser);
    payload.refreshToken = generateRefreshToken(targetUser);
  }

  return sendSuccess(res, {
    statusCode: isNewAccount ? 201 : 200,
    message: needsLogin
      ? 'Votre compte existant est désormais Partenaire VIP à vie ! Connectez-vous pour accéder à votre Dashboard Partenaire.'
      : 'Félicitations ! Votre accès à vie et votre Espace Partenaire sont immédiatement activés.',
    data: payload,
  });
});

/**
 * GET /api/v1/partnership/my-dashboard  (AUTH)
 * Returns the authenticated partner's full statistics, per-affiliate earnings,
 * commissions breakdown, monthly activity check, and H2H payout history.
 */
export const getMyPartnerDashboard = asyncHandler(async (req, res) => {
  await releaseDueScheduledCommissions();

  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound('Utilisateur introuvable.');

  if (!user.referralCode) {
    user.referralCode = (user.firstName ? user.firstName.slice(0, 3).toUpperCase() : 'TRD') + Math.random().toString(36).substring(2, 6).toUpperCase();
    await user.save();
  }

  const cfg = await getOrCreatePartnershipConfig();
  const commissionRate = cfg.commissionRate || 30;
  const isActivePartner = Boolean(user.partnership?.isActive && user.partnership?.status === 'active');

  // All users who registered with this partner's referral link
  const referredUsers = await User.find({ referredBy: user._id })
    .select('firstName lastName email subscription createdAt trial')
    .sort({ createdAt: -1 })
    .lean();

  const commissions = await PartnerCommission.find({ partner: user._id })
    .populate('referredUser', 'firstName lastName email subscription createdAt')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const payouts = await PayoutTransaction.find({ role: 'partner', user: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Map per-user earnings & payment counts
  const earningsByUserId = new Map();
  const payingUserIds = new Set();

  for (const c of commissions) {
    const uid = String(c.referredUser?._id || c.referredUser || '');
    if (!uid) continue;
    payingUserIds.add(uid);
    const curr = earningsByUserId.get(uid) || { totalPaid: 0, totalCommission: 0, scheduledCommission: 0, paymentsCount: 0, lastPaidAt: null };
    curr.totalPaid += Number(c.grossAmount || 0);
    if (c.status === 'credited') {
      curr.totalCommission += Number(c.partnerAmount || 0);
    } else if (c.status === 'scheduled') {
      curr.scheduledCommission += Number(c.partnerAmount || 0);
    }
    curr.paymentsCount += 1;
    if (!curr.lastPaidAt || new Date(c.createdAt) > new Date(curr.lastPaidAt)) {
      curr.lastPaidAt = c.createdAt;
    }
    earningsByUserId.set(uid, curr);
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const monthlyInvitedCount = referredUsers.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length;
  const monthlyInactiveWarning = isActivePartner ? await isPartnerInactiveMonthly(user) : false;

  const referredUsersDetailed = referredUsers.map((ru) => {
    const uid = String(ru._id);
    const stats = earningsByUserId.get(uid) || {
      totalPaid: 0,
      totalCommission: 0,
      scheduledCommission: 0,
      paymentsCount: 0,
      lastPaidAt: null,
    };
    const isPaying = stats.paymentsCount > 0 || (ru.subscription?.status === 'active' && !['free', null].includes(ru.subscription?.plan));
    if (isPaying) payingUserIds.add(uid);

    return {
      _id: ru._id,
      name: `${ru.firstName || ''} ${ru.lastName || ''}`.trim() || ru.email,
      email: ru.email,
      registeredAt: ru.createdAt,
      subscriptionPlan: ru.subscription?.plan || 'free',
      subscriptionStatus: ru.subscription?.status || 'inactive',
      hasPaid: isPaying,
      totalPaidByUser: stats.totalPaid,
      partnerEarningsFromUser: stats.totalCommission,
      scheduledEarnings: stats.scheduledCommission,
      paymentsCount: stats.paymentsCount,
      lastPaidAt: stats.lastPaidAt,
    };
  });

  const affiliateLink = `${config.frontendUrl}/?ref=${user.referralCode}`;

  return sendSuccess(res, {
    data: {
      partnership: {
        isActive: isActivePartner,
        status: user.partnership?.status || 'none',
        lifetimeAccess: Boolean(user.partnership?.lifetimeAccess),
        joinedAt: user.partnership?.joinedAt,
        balance: user.partnership?.balance || 0,
        totalEarned: user.partnership?.totalEarned || 0,
        totalWithdrawn: user.partnership?.totalWithdrawn || 0,
        excludedReason: user.partnership?.excludedReason || '',
        excludedAt: user.partnership?.excludedAt || null,
        fullName: user.partnership?.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.partnership?.email || user.email,
        phone: user.partnership?.phone || user.phone || '',
      },
      programConfig: {
        isEnabled: Boolean(cfg.isEnabled && !cfg.isDeleted),
        commissionRate,
        currency: cfg.currency || 'XOF',
        creditTiming: cfg.creditTiming || 'instant',
        h2hCountries: IKEEPAY_H2H_COUNTRIES,
      },
      referralCode: user.referralCode,
      affiliateLink,
      stats: {
        totalInvited: referredUsers.length,
        payingUsersCount: payingUserIds.size,
        monthlyInvitedCount,
        monthlyInactiveWarning,
      },
      referredUsers: referredUsersDetailed,
      commissions,
      payouts,
    },
  });
});

/**
 * POST /api/v1/partnership/withdraw  (AUTH)
 * Partner withdraws available commission earnings via iKeePay H2H Payout (POST /h2h-payout).
 */
export const withdrawPartnerEarnings = asyncHandler(async (req, res) => {
  await releaseDueScheduledCommissions();

  const { amount, country = 'CI', operator = 'ORANGE', phoneNumber } = req.body;
  const withdrawAmount = Math.round(Number(amount));
  if (!withdrawAmount || withdrawAmount < 200) {
    throw ApiError.badRequest('Le montant minimum de retrait est de 200 FCFA.');
  }
  if (!phoneNumber || String(phoneNumber).replace(/[^\d]/g, '').length < 8) {
    throw ApiError.badRequest('Numéro de téléphone Mobile Money valide requis.');
  }

  const provider = getConfiguredIkeepayProvider();
  const cfg = await getOrCreatePartnershipConfig();
  const currency = cfg.currency || 'XOF';

  // Atomic check & reserve balance
  const partner = await User.findOneAndUpdate(
    {
      _id: req.user._id,
      'partnership.isActive': true,
      'partnership.status': 'active',
      'partnership.balance': { $gte: withdrawAmount },
    },
    { $inc: { 'partnership.balance': -withdrawAmount } },
    { new: true }
  );

  if (!partner) {
    const check = await User.findById(req.user._id);
    if (!check?.partnership?.isActive || check?.partnership?.status !== 'active') {
      throw ApiError.forbidden("Votre statut Partenaire n'est pas actif pour effectuer un retrait.");
    }
    throw ApiError.badRequest(`Solde insuffisant. Solde disponible : ${Number(check.partnership.balance || 0).toLocaleString()} ${currency}.`);
  }

  const externalRef = `PAYOUT_PART_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const payout = await PayoutTransaction.create({
    role: 'partner',
    user: partner._id,
    amount: withdrawAmount,
    currency,
    country: String(country || 'CI').toUpperCase(),
    phoneNumber: String(phoneNumber).trim(),
    operator: String(operator || 'ORANGE').toUpperCase(),
    externalRef,
    status: 'pending',
  });

  try {
    if (!provider.isConfigured()) {
      const activeProvider = settingsService.getValue('payments.provider') || config.payments.provider;
      if (activeProvider === 'demo') {
        payout.status = 'approved';
        payout.providerRef = `DEMO_${externalRef}`;
        await payout.save();
        await User.findByIdAndUpdate(partner._id, { $inc: { 'partnership.totalWithdrawn': withdrawAmount } });
        return sendSuccess(res, {
          message: 'Retrait Partenaire effectué (mode démo).',
          data: { payout, remainingBalance: partner.partnership.balance },
        });
      }
      throw new Error("Clé secrète iKeePay H2H (x-api-key) manquante dans la configuration Admin.");
    }

    const h2hRes = await provider.initiatePayout({
      amount: withdrawAmount,
      currency,
      country,
      phoneNumber,
      operator,
      external_reference: externalRef,
    });

    payout.providerRef = h2hRes.providerRef || undefined;
    payout.rawResponse = h2hRes.raw;
    payout.status = h2hRes.status === 'approved' ? 'approved' : h2hRes.status === 'rejected' ? 'rejected' : 'pending';
    await payout.save();

    if (payout.status === 'approved') {
      await User.findByIdAndUpdate(partner._id, { $inc: { 'partnership.totalWithdrawn': withdrawAmount } });
    } else if (payout.status === 'rejected') {
      await User.findByIdAndUpdate(partner._id, { $inc: { 'partnership.balance': withdrawAmount } });
      throw new Error('Le retrait a été rejeté par iKeePay.');
    }

    return sendSuccess(res, {
      message: payout.status === 'approved'
        ? `Retrait de ${withdrawAmount.toLocaleString()} ${currency} transféré avec succès via iKeePay !`
        : `Retrait de ${withdrawAmount.toLocaleString()} ${currency} initié via iKeePay H2H.`,
      data: { payout, remainingBalance: partner.partnership.balance },
    });
  } catch (err) {
    // Refund reserved balance on immediate API/config error
    await User.findByIdAndUpdate(partner._id, { $inc: { 'partnership.balance': withdrawAmount } });
    payout.status = 'failed';
    payout.error = err.message;
    await payout.save();
    throw ApiError.badRequest(err.message || 'Impossible de traiter le retrait iKeePay.');
  }
});

/**
 * POST /api/v1/partnership/payout/verify  (AUTH)
 * Sync partner payout status via GET /h2h-verify/:reference.
 */
export const verifyPartnerPayout = asyncHandler(async (req, res) => {
  const { externalRef } = req.body;
  if (!externalRef) throw ApiError.badRequest('Référence du retrait requise.');

  const payout = await PayoutTransaction.findOne({ externalRef, role: 'partner', user: req.user._id });
  if (!payout) throw ApiError.notFound('Retrait introuvable.');

  if (payout.status === 'approved' || payout.status === 'rejected' || payout.status === 'failed') {
    return sendSuccess(res, { data: { payout } });
  }

  const provider = getConfiguredIkeepayProvider();
  const verification = await provider.verifyTransaction(payout.externalRef || payout.providerRef);

  if (verification.providerRef && !payout.providerRef) {
    payout.providerRef = verification.providerRef;
  }

  if (verification.valid || verification.status === 'approved') {
    payout.status = 'approved';
    await payout.save();
    await User.findByIdAndUpdate(payout.user, { $inc: { 'partnership.totalWithdrawn': payout.amount } });
  } else if (verification.status === 'rejected') {
    payout.status = 'rejected';
    await payout.save();
    await User.findByIdAndUpdate(payout.user, { $inc: { 'partnership.balance': payout.amount } });
  }

  return sendSuccess(res, { data: { payout } });
});

/* ============================================================================
 * ADMIN PARTNERSHIP CONTROLLERS
 * ============================================================================ */

/**
 * GET /api/v1/admin/partnership/overview  (ADMIN)
 */
export const adminGetPartnershipOverview = asyncHandler(async (req, res) => {
  await releaseDueScheduledCommissions();

  const cfg = await getOrCreatePartnershipConfig();
  const partnersDocs = await User.find({ 'partnership.status': { $ne: 'none' } })
    .select('firstName lastName email phone referralCode partnership subscription createdAt')
    .sort({ 'partnership.joinedAt': -1 })
    .lean();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const partnerIds = partnersDocs.map((p) => p._id);

  // Batch aggregate referred users + monthly affiliates + commissions
  const [referredAgg, monthlyAgg, commissionAgg, membershipPayments, adminPayouts, recentCommissions] = await Promise.all([
    User.aggregate([
      { $match: { referredBy: { $in: partnerIds } } },
      {
        $group: {
          _id: '$referredBy',
          totalInvited: { $sum: 1 },
          activeSubCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$subscription.status', 'active'] },
                    { $not: { $in: ['$subscription.plan', ['free', null]] } },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
    User.aggregate([
      { $match: { referredBy: { $in: partnerIds }, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: '$referredBy', monthlyCount: { $sum: 1 } } },
    ]),
    PartnerCommission.aggregate([
      { $match: { partner: { $in: partnerIds } } },
      {
        $group: {
          _id: '$partner',
          payingUsersSet: { $addToSet: '$referredUser' },
          totalGross: { $sum: '$grossAmount' },
          totalPartnerEarned: { $sum: '$partnerAmount' },
          totalAdminShare: { $sum: '$adminAmount' },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { purpose: 'partnership', status: 'approved' } },
      { $group: { _id: null, totalSales: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    PayoutTransaction.find({ role: 'admin' }).sort({ createdAt: -1 }).limit(50).lean(),
    PartnerCommission.find({})
      .populate('partner', 'firstName lastName email partnership.fullName')
      .populate('referredUser', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const refMap = new Map(referredAgg.map((r) => [String(r._id), r]));
  const monMap = new Map(monthlyAgg.map((m) => [String(m._id), m.monthlyCount]));
  const comMap = new Map(commissionAgg.map((c) => [String(c._id), c]));

  const partners = partnersDocs.map((p) => {
    const idStr = String(p._id);
    const refStats = refMap.get(idStr) || { totalInvited: 0, activeSubCount: 0 };
    const monthlyAffiliatesCount = monMap.get(idStr) || 0;
    const comStats = comMap.get(idStr) || { payingUsersSet: [], totalGross: 0, totalPartnerEarned: 0, totalAdminShare: 0 };

    const payingUsersCount = Math.max(comStats.payingUsersSet.length, refStats.activeSubCount);
    const joinedAt = p.partnership?.joinedAt ? new Date(p.partnership.joinedAt).getTime() : now;
    const eligibleForMonthlyExclusion =
      p.partnership?.status === 'active' &&
      now - joinedAt >= thirtyDaysMs &&
      monthlyAffiliatesCount === 0;

    return {
      _id: p._id,
      email: p.email,
      accountName: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email,
      formFullName: p.partnership?.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      formEmail: p.partnership?.email || p.email,
      formPhone: p.partnership?.phone || p.phone || '',
      formSubmitted: Boolean(p.partnership?.formSubmitted),
      formSubmittedAt: p.partnership?.formSubmittedAt,
      paymentRef: p.partnership?.paymentRef || '',
      paidAmount: p.partnership?.paidAmount || 0,
      referralCode: p.referralCode,
      status: p.partnership?.status || 'none',
      isActive: Boolean(p.partnership?.isActive),
      lifetimeAccess: Boolean(p.partnership?.lifetimeAccess),
      joinedAt: p.partnership?.joinedAt,
      excludedReason: p.partnership?.excludedReason || '',
      excludedAt: p.partnership?.excludedAt || null,
      balance: p.partnership?.balance || 0,
      totalEarned: p.partnership?.totalEarned || 0,
      totalWithdrawn: p.partnership?.totalWithdrawn || 0,
      totalInvited: refStats.totalInvited,
      payingUsersCount,
      monthlyAffiliatesCount,
      eligibleForMonthlyExclusion,
      totalGrossGenerated: comStats.totalGross,
      totalAdminShareFromPartner: comStats.totalAdminShare,
    };
  });

  const activePartnersCount = partners.filter((p) => p.isActive && p.status === 'active').length;
  const maxPartners = Math.max(1, Number(cfg.maxPartners || 50));

  return sendSuccess(res, {
    data: {
      config: cfg,
      activePartnersCount,
      spotsRemaining: Math.max(0, maxPartners - activePartnersCount),
      partners,
      adminRevenue: {
        poolBalance: cfg.adminPoolBalance || 0,
        totalAdminShareEarned: cfg.adminPoolTotalEarned || 0,
        totalAdminWithdrawn: cfg.adminPoolTotalWithdrawn || 0,
        partnershipSalesTotal: membershipPayments[0]?.totalSales || 0,
        partnershipSalesCount: membershipPayments[0]?.count || 0,
      },
      adminPayouts,
      recentCommissions,
      h2hCountries: IKEEPAY_H2H_COUNTRIES,
    },
  });
});

/**
 * PUT /api/v1/admin/partnership/config  (ADMIN)
 */
export const adminUpdatePartnershipConfig = asyncHandler(async (req, res) => {
  const cfg = await getOrCreatePartnershipConfig();
  const fields = [
    'isEnabled',
    'isDeleted',
    'title',
    'subtitle',
    'badgeText',
    'price',
    'currency',
    'maxPartners',
    'commissionRate',
    'creditTiming',
    'benefits',
    'termsAndConditions',
  ];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      cfg[field] = req.body[field];
    }
  }

  cfg.commissionRate = Math.max(1, Math.min(95, Number(cfg.commissionRate || 30)));
  cfg.maxPartners = Math.max(1, Number(cfg.maxPartners || 50));
  cfg.price = Math.max(0, Number(cfg.price || 0));

  await cfg.save();

  await logAdmin('update_partnership_config', {
    message: `Admin mis à jour le Programme de Partenariat (Prix: ${cfg.price} ${cfg.currency}, Max: ${cfg.maxPartners}, Commission: ${cfg.commissionRate}%, Actif: ${cfg.isEnabled})`,
    userId: req.user._id,
    ip: req.ip,
  });

  return sendSuccess(res, {
    message: 'Configuration du Programme de Partenariat mise à jour.',
    data: { config: cfg },
  });
});

/**
 * DELETE /api/v1/admin/partnership/config  (ADMIN)
 * Soft-deletes the partnership program (hides it from the website).
 */
export const adminDeletePartnershipProgram = asyncHandler(async (req, res) => {
  const cfg = await getOrCreatePartnershipConfig();
  cfg.isDeleted = true;
  cfg.isEnabled = false;
  await cfg.save();

  await logAdmin('delete_partnership_program', {
    message: 'Admin a supprimé / masqué le Programme de Partenariat',
    userId: req.user._id,
    ip: req.ip,
  });

  return sendSuccess(res, {
    message: 'Le Programme de Partenariat a été supprimé du site public.',
    data: { config: cfg },
  });
});

/**
 * PATCH /api/v1/admin/partnership/partners/:userId/status  (ADMIN)
 * Allows Admin to exclude, deactivate, re-activate, or remove a partner.
 */
export const adminUpdatePartnerStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { action, reason } = req.body; // 'activate' | 'exclude' | 'disable' | 'remove'

  const partner = await User.findById(userId);
  if (!partner) throw ApiError.notFound('Partenaire introuvable.');

  if (!partner.partnership) partner.partnership = {};

  if (action === 'activate') {
    partner.partnership.isActive = true;
    partner.partnership.status = 'active';
    partner.partnership.lifetimeAccess = true;
    if (!partner.partnership.joinedAt) partner.partnership.joinedAt = new Date();
    partner.partnership.excludedAt = null;
    partner.partnership.excludedReason = '';
    partner.subscription.status = 'active';
    partner.subscription.scansPerMonth = -1;
    if (!partner.subscription.plan || partner.subscription.plan === 'free') {
      partner.subscription.plan = 'partner_lifetime';
    }
  } else if (action === 'exclude' || action === 'disable' || action === 'remove') {
    partner.partnership.isActive = false;
    partner.partnership.status = action === 'remove' ? 'none' : action === 'exclude' ? 'excluded' : 'disabled';
    partner.partnership.lifetimeAccess = false;
    partner.partnership.excludedAt = new Date();
    partner.partnership.excludedReason =
      reason || (action === 'exclude' ? 'Exclu pour inactivité mensuelle (0 affilié)' : "Programme désactivé par l'administrateur");

    // Revoke lifetime access immediately if they don't have an active paid subscription with a future endDate
    const hasValidPaidEnd =
      partner.subscription?.plan !== 'partner_lifetime' &&
      partner.subscription?.endDate &&
      new Date(partner.subscription.endDate) > new Date();

    if (!hasValidPaidEnd) {
      partner.subscription.status = 'expired';
    }
  } else {
    throw ApiError.badRequest("Action invalide. Utilisez 'activate', 'exclude', 'disable' ou 'remove'.");
  }

  await partner.save();

  await logAdmin('update_partner_status', {
    message: `Admin statut partenaire (${action}) pour ${partner.email}`,
    userId: req.user._id,
    ip: req.ip,
    metadata: { partnerId: partner._id, action, reason },
  });

  return sendSuccess(res, {
    message:
      action === 'activate'
        ? `Le partenaire ${partner.email} a été réactivé avec succès.`
        : `Le partenaire ${partner.email} a été exclu/désactivé.`,
    data: { partner },
  });
});

/**
 * POST /api/v1/admin/partnership/release-commissions  (ADMIN)
 */
export const adminReleaseDueCommissions = asyncHandler(async (req, res) => {
  const released = await releaseDueScheduledCommissions();
  return sendSuccess(res, {
    message: `${released} commission(s) arrivée(s) à échéance libérée(s).`,
    data: { released },
  });
});

/**
 * POST /api/v1/admin/partnership/withdraw  (ADMIN)
 * Admin withdraws accumulated 70% admin share via iKeePay H2H Payout (POST /h2h-payout).
 */
export const adminWithdrawRevenuePool = asyncHandler(async (req, res) => {
  await releaseDueScheduledCommissions();

  const { amount, country = 'CI', operator = 'ORANGE', phoneNumber } = req.body;
  const withdrawAmount = Math.round(Number(amount));
  if (!withdrawAmount || withdrawAmount < 200) {
    throw ApiError.badRequest('Le montant minimum de retrait est de 200 FCFA.');
  }
  if (!phoneNumber || String(phoneNumber).replace(/[^\d]/g, '').length < 8) {
    throw ApiError.badRequest('Numéro de téléphone Mobile Money requis.');
  }

  const provider = getConfiguredIkeepayProvider();

  // Atomic check & deduct on singleton PartnershipConfig
  const cfg = await PartnershipConfig.findOneAndUpdate(
    { key: 'default', adminPoolBalance: { $gte: withdrawAmount } },
    { $inc: { adminPoolBalance: -withdrawAmount } },
    { new: true }
  );

  if (!cfg) {
    const current = await getOrCreatePartnershipConfig();
    throw ApiError.badRequest(
      `Solde Admin insuffisant. Disponible : ${Number(current.adminPoolBalance || 0).toLocaleString()} ${current.currency || 'XOF'}.`
    );
  }

  const currency = cfg.currency || 'XOF';
  const externalRef = `PAYOUT_ADMIN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  const payout = await PayoutTransaction.create({
    role: 'admin',
    user: req.user._id,
    amount: withdrawAmount,
    currency,
    country: String(country || 'CI').toUpperCase(),
    phoneNumber: String(phoneNumber).trim(),
    operator: String(operator || 'ORANGE').toUpperCase(),
    externalRef,
    status: 'pending',
  });

  try {
    if (!provider.isConfigured()) {
      const activeProvider = settingsService.getValue('payments.provider') || config.payments.provider;
      if (activeProvider === 'demo') {
        payout.status = 'approved';
        payout.providerRef = `DEMO_${externalRef}`;
        await payout.save();
        await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolTotalWithdrawn: withdrawAmount } });
        return sendSuccess(res, {
          message: 'Retrait Admin approuvé (mode démo).',
          data: { payout, remainingPoolBalance: cfg.adminPoolBalance },
        });
      }
      throw new Error("Clé secrète iKeePay H2H (x-api-key) non configurée.");
    }

    const h2hRes = await provider.initiatePayout({
      amount: withdrawAmount,
      currency,
      country,
      phoneNumber,
      operator,
      external_reference: externalRef,
    });

    payout.providerRef = h2hRes.providerRef || undefined;
    payout.rawResponse = h2hRes.raw;
    payout.status = h2hRes.status === 'approved' ? 'approved' : h2hRes.status === 'rejected' ? 'rejected' : 'pending';
    await payout.save();

    if (payout.status === 'approved') {
      await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolTotalWithdrawn: withdrawAmount } });
    } else if (payout.status === 'rejected') {
      await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolBalance: withdrawAmount } });
      throw new Error('Retrait Admin rejeté par iKeePay.');
    }

    await logAdmin('admin_payout', {
      message: `Admin retrait iKeePay H2H de ${withdrawAmount} ${currency} vers ${phoneNumber} (${operator})`,
      userId: req.user._id,
      ip: req.ip,
    });

    return sendSuccess(res, {
      message: payout.status === 'approved'
        ? `Retrait Admin de ${withdrawAmount.toLocaleString()} ${currency} transféré !`
        : `Retrait Admin de ${withdrawAmount.toLocaleString()} ${currency} initié via iKeePay H2H.`,
      data: { payout, remainingPoolBalance: cfg.adminPoolBalance },
    });
  } catch (err) {
    await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolBalance: withdrawAmount } });
    payout.status = 'failed';
    payout.error = err.message;
    await payout.save();
    throw ApiError.badRequest(err.message || 'Échec du retrait Admin iKeePay H2H.');
  }
});

/**
 * POST /api/v1/admin/partnership/payout/verify  (ADMIN)
 */
export const adminVerifyPayout = asyncHandler(async (req, res) => {
  const { externalRef } = req.body;
  if (!externalRef) throw ApiError.badRequest('Référence du retrait requise.');

  const payout = await PayoutTransaction.findOne({ externalRef, role: 'admin' });
  if (!payout) throw ApiError.notFound('Retrait Admin introuvable.');

  if (payout.status === 'approved' || payout.status === 'rejected' || payout.status === 'failed') {
    return sendSuccess(res, { data: { payout } });
  }

  const provider = getConfiguredIkeepayProvider();
  const verification = await provider.verifyTransaction(payout.externalRef || payout.providerRef);

  if (verification.providerRef && !payout.providerRef) {
    payout.providerRef = verification.providerRef;
  }

  if (verification.valid || verification.status === 'approved') {
    payout.status = 'approved';
    await payout.save();
    await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolTotalWithdrawn: payout.amount } });
  } else if (verification.status === 'rejected') {
    payout.status = 'rejected';
    await payout.save();
    await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolBalance: payout.amount } });
  }

  return sendSuccess(res, { data: { payout } });
});
