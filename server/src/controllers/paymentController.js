import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Payment from '../models/Payment.js';
import PayoutTransaction from '../models/PayoutTransaction.js';
import PartnershipConfig from '../models/PartnershipConfig.js';
import User from '../models/User.js';
import { getPlanById } from '../services/planService.js';
import {
  getProvider,
  IkeepayProvider,
  SEBPAY_SIGNATURE_HEADER,
  IKEEPAY_SIGNATURE_HEADER,
  IKEEPAY_H2H_COUNTRIES,
} from '../services/payments/index.js';
import { logAuth } from '../services/logService.js';
import * as settingsService from '../services/settings/settingsService.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import {
  getConfiguredIkeepayProvider,
  processPartnerCommissionSplit,
  resolvePlanDurationMonths,
} from '../services/partnershipService.js';

const OPERATORS = ['mtn', 'moov', 'orange', 'wave', 'mobicash', 'airtel', 'vodacom', 'standard', 'card'];

/**
 * Apply a paid plan to a user (shared by checkout, webhook & verify)
 * and trigger either VIP Partner 30%/70% revenue split or legacy referral credit.
 */
const activatePlan = async (user, plan, payment = null) => {
  const wasActive = Boolean(user.subscription?.startDate && (user.subscription?.status === 'active' || user.subscription?.renewalCount > 0));

  user.subscription.plan = plan.id;
  user.subscription.status = 'active';
  user.subscription.scansPerMonth = -1; // illimité pour tous les forfaits
  user.subscription.scansUsed = 0; // reset quota on subscription
  user.subscription.startDate = new Date();

  const months = resolvePlanDurationMonths(plan);
  const end = new Date();
  end.setMonth(end.getMonth() + months);
  user.subscription.endDate = end;

  if (user.trial) {
    user.trial.isActive = false; // Fin de l'essai gratuit, abonnement actif
  }
  if (wasActive) {
    user.subscription.renewalCount = (user.subscription.renewalCount || 0) + 1;
    user.subscription.lastRenewedAt = new Date();
    user.subscription.isRenewed = true;
  }

  await user.save();

  // Credit VIP Partner (configurable 30% partner / 70% admin split) or legacy referral (20%)
  if (user.referredBy) {
    try {
      const paidAmount = payment?.amount ?? plan.effectivePrice ?? plan.price ?? 7000;
      const handledByPartner = await processPartnerCommissionSplit({
        subscriber: user,
        payment,
        plan,
        paidAmount,
      });

      if (!handledByPartner) {
        const referrer = await User.findById(user.referredBy);
        if (referrer && referrer.referral?.enabled) {
          const rate = (referrer.referral.commissionRate || 20) / 100;
          const commission = Math.round(paidAmount * rate);
          if (commission > 0) {
            referrer.referral.balance = (referrer.referral.balance || 0) + commission;
            referrer.referral.totalEarned = (referrer.referral.totalEarned || 0) + commission;
            await referrer.save();
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to credit referral/partner commission on activatePlan: ${err.message}`);
    }
  }

  await logAuth('subscription_paid', {
    message: wasActive
      ? `🔄 Renouvellement d'abonnement : ${user.email} (${plan.name}) — Renouvellement #${user.subscription.renewalCount}`
      : `Souscription abonnement : ${plan.name}`,
    userId: user._id,
    metadata: {
      planId: plan.id,
      renewalCount: user.subscription.renewalCount,
      endDate: user.subscription.endDate,
    },
  });
};

/**
 * Resolve currency for iKeePay H2H payin based on country & plan price.
 */
const resolveH2HAmountAndCurrency = (planPrice, planCurrency, country = 'CI') => {
  const ctry = IKEEPAY_H2H_COUNTRIES.find((c) => c.code === String(country || 'CI').toUpperCase());
  const targetCurrency = ctry?.currency || 'XOF';
  const upperPlanCurr = String(planCurrency || 'XOF').toUpperCase();

  if (['XAF', 'XOF', 'FCFA'].includes(upperPlanCurr) && ['XOF', 'XAF'].includes(targetCurrency)) {
    return { amount: Math.round(Number(planPrice)), currency: targetCurrency };
  }
  if (upperPlanCurr === 'USD' && ['XOF', 'XAF'].includes(targetCurrency)) {
    return { amount: Math.round(Number(planPrice) * 655), currency: targetCurrency };
  }
  if (['XOF', 'XAF', 'FCFA'].includes(upperPlanCurr) && targetCurrency === 'USD') {
    return { amount: Math.max(1, Number((Number(planPrice) / 655).toFixed(2))), currency: 'USD' };
  }
  return { amount: Math.round(Number(planPrice)), currency: targetCurrency || 'XOF' };
};

/**
 * GET /payments/config (public/auth)
 * Returns public payment configuration (active provider, H2H countries/operators).
 */
export const getPaymentConfig = asyncHandler(async (req, res) => {
  const activeProvider = settingsService.getValue('payments.provider') || config.payments.provider || 'ikeepay';
  const ikeepaySecretKey = settingsService.getValue('payments.ikeepay.secretKey') || config.payments.ikeepay?.secretKey || '';
  const ikeepayPublicKey = settingsService.getValue('payments.ikeepay.publicKey') || config.payments.ikeepay?.publicKey || '';
  const ikeepayMobile = settingsService.getValue('payments.ikeepay.mobileMoneyEnabled');
  const mobileMoneyEnabled = ikeepayMobile !== undefined ? Boolean(ikeepayMobile) : (config.payments.ikeepay?.mobileMoneyEnabled ?? true);

  return sendSuccess(res, {
    data: {
      activeProvider,
      ikeepay: {
        mode: 'h2h',
        configured: Boolean(ikeepaySecretKey && ikeepaySecretKey.trim()),
        hasPublicKey: Boolean(ikeepayPublicKey && ikeepayPublicKey.trim()),
        mobileMoneyEnabled,
        currency: config.payments.currency || 'XOF',
        countries: IKEEPAY_H2H_COUNTRIES,
      },
      sebpay: {
        configured: Boolean(settingsService.getValue('payments.sebpay.secretKey') || config.payments.sebpay?.secretKey),
      },
      whatsappUrl: settingsService.getValue('contact.whatsappUrl') || config.contact?.whatsappUrl || 'https://wa.me/22900000000',
    },
  });
});

/**
 * POST /payments/ikeepay/initiate  (auth)
 * Initiates an authenticated iKeePay H2H payin (POST /h2h-payin).
 */
export const initiateIkeepay = asyncHandler(async (req, res) => {
  const { planId, country = 'CI', operator = 'ORANGE', otp, phoneNumber, phone, customerEmail } = req.body;
  if (!planId) throw ApiError.badRequest('Plan ID is required.');

  const plan = await getPlanById(planId, { activeOnly: true });
  if (!plan) throw ApiError.badRequest('Invalid or inactive plan.');

  const effectivePrice = (plan.promo?.enabled && Number(plan.promo?.price) > 0)
    ? Number(plan.promo.price)
    : Number(plan.price || 0);

  if (effectivePrice <= 0) {
    throw ApiError.badRequest('This plan is free — no payment required.');
  }

  const rawPhone = phoneNumber || phone || req.user.phone || '';
  if (!rawPhone || String(rawPhone).replace(/[^\d]/g, '').length < 8) {
    throw ApiError.badRequest('Votre numéro Mobile Money est requis.');
  }

  const provider = getConfiguredIkeepayProvider();
  const activeProvider = settingsService.getValue('payments.provider') || config.payments.provider;
  const orderId = `REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const { amount: h2hAmount, currency: h2hCurrency } = resolveH2HAmountAndCurrency(effectivePrice, plan.currency, country);

  if (!provider.isConfigured()) {
    if (activeProvider === 'demo') {
      const payment = await Payment.create({
        user: req.user._id,
        customerEmail: req.user.email,
        customerPhone: String(rawPhone).trim(),
        planId: plan.id,
        amount: h2hAmount,
        currency: h2hCurrency,
        type: 'payin',
        purpose: 'subscription',
        country: String(country).toUpperCase(),
        operator: String(operator).toUpperCase(),
        provider: 'demo',
        externalRef: orderId,
        providerRef: `DEMO_${orderId}`,
        method: 'demo',
        status: 'approved',
      });
      await activatePlan(req.user, plan, payment);
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Paiement approuvé (mode démo). Votre plan est actif.',
        data: { paymentId: payment._id, orderId, status: 'approved', amount: h2hAmount, currency: h2hCurrency },
      });
    }
    throw ApiError.badRequest("La clé secrète iKeePay H2H (x-api-key) n'a pas encore été configurée par l'administrateur.");
  }

  const h2hRes = await provider.initiatePayin({
    amount: h2hAmount,
    currency: h2hCurrency,
    country,
    phoneNumber: rawPhone,
    operator,
    external_reference: orderId,
    customer_email: customerEmail || req.user.email,
    otp,
  });

  const payment = await Payment.create({
    user: req.user._id,
    customerEmail: req.user.email,
    customerName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
    customerPhone: String(rawPhone).trim(),
    planId: plan.id,
    amount: h2hAmount,
    currency: h2hCurrency,
    type: 'payin',
    purpose: 'subscription',
    country: String(country).toUpperCase(),
    operator: String(operator).toUpperCase(),
    provider: 'ikeepay',
    providerRef: h2hRes.providerRef || undefined,
    externalRef: orderId,
    paymentLink: h2hRes.paymentLink || '',
    checkoutUrl: h2hRes.paymentLink || '',
    method: 'h2h_payin',
    status: h2hRes.status === 'approved' ? 'approved' : h2hRes.status === 'rejected' ? 'rejected' : 'pending',
    rawResponse: h2hRes.raw,
  });

  if (payment.status === 'approved') {
    await activatePlan(req.user, plan, payment);
  }

  return sendSuccess(res, {
    statusCode: 201,
    message:
      payment.status === 'approved'
        ? 'Paiement confirmé ! Votre abonnement est actif.'
        : h2hRes.paymentLink
        ? 'Lien de redirection généré pour finaliser votre paiement iKeePay.'
        : 'Paiement H2H initié. Confirmez la demande sur votre téléphone.',
    data: {
      paymentId: payment._id,
      orderId,
      providerRef: h2hRes.providerRef || null,
      status: payment.status,
      paymentLink: h2hRes.paymentLink || '',
      amount: h2hAmount,
      currency: h2hCurrency,
      country: payment.country,
      operator: payment.operator,
      plan: { id: plan.id, name: plan.name, price: effectivePrice, currency: h2hCurrency },
    },
  });
});

/**
 * POST /payments/ikeepay/verify  (auth)
 * Checks transaction status via GET /h2h-verify/:reference and activates plan when completed.
 */
export const verifyIkeepay = asyncHandler(async (req, res) => {
  const { orderId, providerRef, ikeepayRef } = req.body;
  const ref = orderId || providerRef || ikeepayRef;
  if (!ref) {
    throw ApiError.badRequest('Référence (orderId ou providerRef) requise.');
  }

  const payment = orderId
    ? await Payment.findOne({ externalRef: orderId, user: req.user._id })
    : await Payment.findOne({ providerRef: providerRef || ikeepayRef, user: req.user._id });

  if (!payment) {
    throw ApiError.notFound('Paiement introuvable.');
  }

  if (payment.status === 'approved') {
    return sendSuccess(res, {
      message: 'Plan déjà activé avec succès.',
      data: { status: 'approved', paymentId: payment._id },
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

    const plan = await getPlanById(payment.planId);
    if (plan) {
      await activatePlan(req.user, plan, payment);
    }

    return sendSuccess(res, {
      message: 'Paiement iKeePay H2H validé ! Votre abonnement est maintenant actif.',
      data: { status: 'approved', paymentId: payment._id, providerRef: payment.providerRef },
    });
  }

  if (verification.status === 'rejected') {
    payment.status = 'rejected';
    await payment.save();
  }

  return sendSuccess(res, {
    message: payment.status === 'rejected' ? 'Paiement refusé ou annulé.' : 'Paiement en attente de confirmation...',
    data: { status: payment.status, paymentId: payment._id, providerRef: payment.providerRef },
  });
});

/**
 * POST /payments/ikeepay/initiate-public  (PUBLIC)
 * Allows unauthenticated visitors to pay via iKeePay H2H before registering.
 */
export const initiatePublicIkeepay = asyncHandler(async (req, res) => {
  const {
    planId,
    email,
    fullName,
    phoneNumber,
    phone,
    country = 'CI',
    operator = 'ORANGE',
    otp,
    referralCode,
  } = req.body;

  if (!planId) throw ApiError.badRequest('Le plan d’abonnement est requis.');
  if (!email) throw ApiError.badRequest('Votre adresse email est requise.');

  const plan = await getPlanById(planId, { activeOnly: true });
  if (!plan) throw ApiError.badRequest('Plan invalide ou inactif.');

  const effectivePrice = (plan.promo?.enabled && Number(plan.promo?.price) > 0)
    ? Number(plan.promo.price)
    : Number(plan.price || 0);

  const orderId = `REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const isFree = effectivePrice <= 0;
  const rawPhone = phoneNumber || phone || '';

  if (isFree) {
    const payment = await Payment.create({
      customerEmail: email.toLowerCase().trim(),
      customerName: fullName || '',
      customerPhone: String(rawPhone).trim(),
      planId: plan.id,
      amount: 0,
      currency: plan.currency || 'XOF',
      type: 'payin',
      purpose: 'subscription',
      country: String(country).toUpperCase(),
      operator: String(operator).toUpperCase(),
      provider: 'ikeepay',
      externalRef: orderId,
      referralCodeUsed: String(referralCode || '').trim().toUpperCase(),
      method: 'free_trial',
      status: 'approved',
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Plan sélectionné avec succès.',
      data: {
        paymentId: payment._id,
        orderId,
        isFree: true,
        status: 'approved',
        amount: 0,
        currency: plan.currency || 'XOF',
        email: email.toLowerCase().trim(),
        fullName: fullName || '',
        plan: { id: plan.id, name: plan.name, price: plan.price, currency: plan.currency || 'XOF' },
      },
    });
  }

  if (!rawPhone || String(rawPhone).replace(/[^\d]/g, '').length < 8) {
    throw ApiError.badRequest('Veuillez saisir un numéro Mobile Money valide.');
  }

  const provider = getConfiguredIkeepayProvider();
  const activeProvider = settingsService.getValue('payments.provider') || config.payments.provider;
  const { amount: h2hAmount, currency: h2hCurrency } = resolveH2HAmountAndCurrency(effectivePrice, plan.currency, country);

  if (!provider.isConfigured()) {
    if (activeProvider === 'demo') {
      const payment = await Payment.create({
        customerEmail: email.toLowerCase().trim(),
        customerName: fullName || '',
        customerPhone: String(rawPhone).trim(),
        planId: plan.id,
        amount: h2hAmount,
        currency: h2hCurrency,
        type: 'payin',
        purpose: 'subscription',
        country: String(country).toUpperCase(),
        operator: String(operator).toUpperCase(),
        provider: 'demo',
        externalRef: orderId,
        providerRef: `DEMO_${orderId}`,
        referralCodeUsed: String(referralCode || '').trim().toUpperCase(),
        method: 'demo',
        status: 'approved',
      });
      return sendSuccess(res, {
        statusCode: 201,
        message: 'Paiement approuvé (mode démo).',
        data: {
          paymentId: payment._id,
          orderId,
          status: 'approved',
          isFree: false,
          amount: h2hAmount,
          currency: h2hCurrency,
          email: payment.customerEmail,
          fullName: payment.customerName,
          plan: { id: plan.id, name: plan.name, price: effectivePrice, currency: h2hCurrency },
        },
      });
    }
    throw ApiError.badRequest("Le moyen de paiement iKeePay H2H n'est pas encore configuré par l'administrateur (Clé secrète x-api-key manquante).");
  }

  const h2hRes = await provider.initiatePayin({
    amount: h2hAmount,
    currency: h2hCurrency,
    country,
    phoneNumber: rawPhone,
    operator,
    external_reference: orderId,
    customer_email: email,
    otp,
  });

  const payment = await Payment.create({
    customerEmail: email.toLowerCase().trim(),
    customerName: fullName || '',
    customerPhone: String(rawPhone).trim(),
    planId: plan.id,
    amount: h2hAmount,
    currency: h2hCurrency,
    type: 'payin',
    purpose: 'subscription',
    country: String(country).toUpperCase(),
    operator: String(operator).toUpperCase(),
    provider: 'ikeepay',
    providerRef: h2hRes.providerRef || undefined,
    externalRef: orderId,
    paymentLink: h2hRes.paymentLink || '',
    checkoutUrl: h2hRes.paymentLink || '',
    referralCodeUsed: String(referralCode || '').trim().toUpperCase(),
    method: 'h2h_payin',
    status: h2hRes.status === 'approved' ? 'approved' : h2hRes.status === 'rejected' ? 'rejected' : 'pending',
    rawResponse: h2hRes.raw,
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: payment.status === 'approved'
      ? 'Paiement validé avec succès !'
      : h2hRes.paymentLink
      ? 'Lien de paiement généré. Complétez votre paiement pour activer votre accès.'
      : 'Paiement initié. Confirmez la transaction sur votre téléphone.',
    data: {
      paymentId: payment._id,
      orderId,
      providerRef: h2hRes.providerRef || null,
      status: payment.status,
      isFree: false,
      amount: h2hAmount,
      currency: h2hCurrency,
      country: payment.country,
      operator: payment.operator,
      paymentLink: h2hRes.paymentLink || '',
      email: payment.customerEmail,
      fullName: payment.customerName,
      plan: {
        id: plan.id,
        name: plan.name,
        price: effectivePrice,
        currency: h2hCurrency,
      },
    },
  });
});

/**
 * POST /payments/ikeepay/verify-public  (PUBLIC)
 * Verifies transaction via GET /h2h-verify/:reference before visitor registers.
 */
export const verifyPublicIkeepay = asyncHandler(async (req, res) => {
  const { orderId, providerRef } = req.body;
  if (!orderId && !providerRef) throw ApiError.badRequest('Référence de commande requise.');

  const payment = orderId
    ? await Payment.findOne({ externalRef: orderId })
    : await Payment.findOne({ providerRef });

  if (!payment) throw ApiError.notFound('Paiement introuvable.');

  if (payment.status === 'approved') {
    return sendSuccess(res, {
      message: 'Paiement déjà validé.',
      data: {
        status: 'approved',
        orderId: payment.externalRef,
        providerRef: payment.providerRef,
        planId: payment.planId,
        email: payment.customerEmail,
      },
    });
  }

  const provider = getConfiguredIkeepayProvider();
  const verification = await provider.verifyTransaction(payment.externalRef || payment.providerRef);

  if (verification.providerRef && !payment.providerRef) {
    payment.providerRef = verification.providerRef;
  }

  if (verification.valid || verification.status === 'approved') {
    payment.status = 'approved';
    await payment.save();
    return sendSuccess(res, {
      message: 'Paiement validé avec succès !',
      data: {
        status: 'approved',
        orderId: payment.externalRef,
        providerRef: payment.providerRef,
        planId: payment.planId,
        email: payment.customerEmail,
      },
    });
  }

  if (verification.status === 'rejected') {
    payment.status = 'rejected';
    await payment.save();
  }

  return sendSuccess(res, {
    message: payment.status === 'rejected' ? 'Paiement refusé ou annulé.' : 'Vérification en attente de confirmation...',
    data: {
      status: payment.status,
      orderId: payment.externalRef,
      providerRef: payment.providerRef,
      planId: payment.planId,
      email: payment.customerEmail,
    },
  });
});

/**
 * POST /payments/webhook/ikeepay  (PUBLIC)
 * Official iKeePay H2H Async Webhook with HMAC SHA-256 verification (X-Ikeepay-Signature).
 *
 * Payload format:
 * {
 *   "event": "transaction.updated",
 *   "data": {
 *     "type": "payin" | "payout",
 *     "external_reference": "REF_1700000000",
 *     "provider_reference": "IKP-H2H-B5C9EC0E",
 *     "amount": 500,
 *     "currency": "XOF",
 *     "country": "CI",
 *     "phone_number": "2250700000000",
 *     "operator": "ORANGE",
 *     "status": "completed" | "pending" | "failed"
 *   }
 * }
 */
export const ikeepayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers[IKEEPAY_SIGNATURE_HEADER];
  const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});

  const provider = getConfiguredIkeepayProvider();
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    logger.warn('iKeePay H2H webhook rejected: invalid X-Ikeepay-Signature.');
    return res.status(401).send('Signature invalide');
  }

  const event = req.body?.event || '';
  const txData = req.body?.data && typeof req.body.data === 'object' ? req.body.data : req.body;
  const txType = String(txData?.type || 'payin').toLowerCase();
  const externalRef = txData?.external_reference || req.body?.order_id || '';
  const providerRef = txData?.provider_reference || req.body?.ikeepay_ref || '';
  const rawStatus = txData?.status || req.body?.status || '';

  logger.info(
    `iKeePay H2H webhook verified: event=${event}, type=${txType}, external_ref=${externalRef}, provider_ref=${providerRef}, status=${rawStatus}`
  );

  if (!externalRef && !providerRef) {
    return res.status(200).send({ received: true, message: 'Missing reference, ignored.' });
  }

  const normalizedStatus = provider.normalizeStatus(rawStatus);

  // 1. Handle Payout Webhook (Partner or Admin withdrawal updates)
  if (txType === 'payout') {
    const payout = externalRef
      ? await PayoutTransaction.findOne({ externalRef })
      : await PayoutTransaction.findOne({ providerRef });

    if (!payout) {
      logger.warn(`iKeePay H2H payout webhook for unknown ref: ${externalRef || providerRef}`);
      return res.status(200).send({ received: true });
    }

    if (providerRef && !payout.providerRef) payout.providerRef = providerRef;
    payout.rawWebhook = req.body;

    if (payout.status === 'approved' || payout.status === 'rejected') {
      return res.status(200).send({ received: true, message: 'Duplicate payout webhook.' });
    }

    if (normalizedStatus === 'approved') {
      payout.status = 'approved';
      await payout.save();
      if (payout.role === 'partner' && payout.user) {
        await User.findByIdAndUpdate(payout.user, { $inc: { 'partnership.totalWithdrawn': payout.amount } });
      } else if (payout.role === 'admin') {
        await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolTotalWithdrawn: payout.amount } });
      }
    } else if (normalizedStatus === 'rejected') {
      payout.status = 'rejected';
      await payout.save();
      if (payout.role === 'partner' && payout.user) {
        await User.findByIdAndUpdate(payout.user, { $inc: { 'partnership.balance': payout.amount } });
      } else if (payout.role === 'admin') {
        await PartnershipConfig.findOneAndUpdate({ key: 'default' }, { $inc: { adminPoolBalance: payout.amount } });
      }
    }

    return res.status(200).send({ received: true });
  }

  // 2. Handle Payin Webhook (Subscription or Partnership payment)
  const payment = externalRef
    ? await Payment.findOne({ externalRef })
    : await Payment.findOne({ providerRef });

  if (!payment) {
    logger.warn(`iKeePay H2H payin webhook for unknown payment: external_ref=${externalRef}, provider_ref=${providerRef}`);
    return res.status(200).send({ received: true });
  }

  payment.webhookReceivedAt = new Date();
  payment.rawWebhook = req.body;
  if (providerRef) payment.providerRef = providerRef;

  if (payment.status === 'approved') {
    return res.status(200).send({ received: true, message: 'Already approved.' });
  }

  if (normalizedStatus === 'approved') {
    payment.status = 'approved';
    await payment.save();

    if (payment.purpose !== 'partnership') {
      const plan = await getPlanById(payment.planId);
      if (plan && payment.user) {
        const user = await User.findById(payment.user);
        if (user) await activatePlan(user, plan, payment);
      }
    }

    await logAuth('payment_webhook', {
      message: `iKeePay H2H Payin approved (${payment.purpose}): ${payment.externalRef}`,
      userId: payment.user,
      metadata: { paymentId: payment._id, planId: payment.planId, providerRef },
    });

    return res.status(200).send({ received: true });
  }

  if (normalizedStatus === 'rejected') {
    payment.status = 'rejected';
    await payment.save();
  }

  return res.status(200).send({ received: true });
});

/**
 * POST /payments/checkout  (auth)
 * Direct checkout delegating to iKeePay H2H, SebPay, or Demo.
 */
export const checkout = asyncHandler(async (req, res) => {
  const { planId, phone, phoneNumber, operator, provider: reqProvider } = req.body;
  if (!planId) throw ApiError.badRequest('Plan ID is required.');

  const plan = await getPlanById(planId, { activeOnly: true });
  if (!plan) throw ApiError.badRequest('Invalid or inactive plan.');
  if (plan.price <= 0) throw ApiError.badRequest('This plan is free — no payment required.');

  const activeProvider = reqProvider || settingsService.getValue('payments.provider') || config.payments.provider;
  if (activeProvider === 'ikeepay') {
    return initiateIkeepay(req, res);
  }

  const rawPhone = phoneNumber || phone || '';
  if (!rawPhone || !String(rawPhone).replace(/\s/g, '')) throw ApiError.badRequest('Phone number is required.');
  if (operator && !OPERATORS.includes(String(operator).toLowerCase())) throw ApiError.badRequest('Invalid operator.');

  const provider = getProvider(activeProvider);
  const payment = await Payment.create({
    user: req.user._id,
    planId: plan.id,
    amount: plan.price,
    currency: plan.currency || config.payments.currency,
    customerPhone: String(rawPhone).replace(/\s/g, ''),
    operator: operator || 'mtn',
    provider: provider.name,
    externalRef: `plan_${plan.id}_${req.user._id}_${Date.now()}`,
    status: 'pending',
  });

  try {
    const result = await provider.createCollection({
      amount: payment.amount,
      currency: payment.currency,
      phone: payment.customerPhone,
      operator: payment.operator,
      externalRef: payment.externalRef,
      description: `Abonnement ${plan.name}`,
    });

    payment.providerRef = result.providerRef;
    payment.status = result.status;
    if (provider.name === 'demo' && result.status === 'pending') {
      payment.status = 'approved';
    }
    await payment.save();

    if (payment.status === 'approved') {
      await activatePlan(req.user, plan, payment);
    }

    return sendSuccess(res, {
      statusCode: 201,
      message:
        payment.status === 'approved'
          ? 'Paiement approuvé (mode démo). Votre plan est actif.'
          : 'Paiement initié. Confirmez la demande sur votre téléphone.',
      data: {
        paymentId: payment._id,
        status: payment.status,
        providerRef: payment.providerRef,
        requiresOtp: false,
        provider: provider.name,
      },
    });
  } catch (err) {
    payment.status = 'failed';
    payment.error = err.message;
    await payment.save();
    logger.error(`Checkout failed: ${err.message}`);
    throw ApiError.internal("Impossible d'initier le paiement. Réessayez.");
  }
});

/**
 * POST /payments/webhook/sebpay  (PUBLIC)
 */
export const webhook = asyncHandler(async (req, res) => {
  const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
  const signature = req.headers[SEBPAY_SIGNATURE_HEADER];

  const provider = getProvider('sebpay');
  if (provider.name === 'sebpay') {
    if (!provider.verifyWebhook(rawBody, signature)) {
      throw ApiError.unauthorized('Invalid webhook signature.');
    }
  }

  const { transaction_id: transactionId, external_reference: externalRef, status } = req.body || {};

  const payment = transactionId
    ? await Payment.findOne({ providerRef: transactionId })
    : await Payment.findOne({ externalRef });

  if (!payment) {
    logger.warn(`Webhook for unknown payment: ${transactionId || externalRef}`);
    return sendSuccess(res, { message: 'Unknown payment, ignored.' });
  }

  const normalized = provider.normalizeStatus(status);
  payment.webhookReceivedAt = new Date();
  payment.rawWebhook = req.body;

  if (payment.status === 'approved' || payment.status === 'rejected') {
    return sendSuccess(res, { message: 'Duplicate webhook, ignored.' });
  }

  payment.status = normalized;
  await payment.save();

  if (normalized === 'approved') {
    const plan = await getPlanById(payment.planId);
    if (plan) {
      const user = await User.findById(payment.user);
      if (user) await activatePlan(user, plan, payment);
    }
  }

  await logAuth('payment_webhook', {
    message: `Payment ${normalized}: ${payment.externalRef}`,
    userId: payment.user,
    metadata: { paymentId: payment._id, planId: payment.planId },
  });

  return sendSuccess(res, { message: `Payment ${normalized}.` });
});

/**
 * GET /payments  (auth) — my payment history.
 */
export const listMine = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const filter = { user: req.user._id };

  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    data: { payments: items },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

/** GET /payments/:id  (auth, own only) */
export const getMine = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!payment) throw ApiError.notFound('Payment not found.');
  return sendSuccess(res, { data: { payment } });
});
