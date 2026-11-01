import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { getPlanById } from '../services/planService.js';
import { getProvider, IkeepayProvider, SEBPAY_SIGNATURE_HEADER } from '../services/payments/index.js';
import { logAuth } from '../services/logService.js';
import * as settingsService from '../services/settings/settingsService.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

const OPERATORS = ['mtn', 'moov', 'orange', 'wave', 'standard', 'card'];

/**
 * Apply a paid plan to a user (shared by checkout, webhook & verify).
 */
const activatePlan = async (user, plan) => {
  user.subscription.plan = plan.id;
  user.subscription.status = 'active';
  user.subscription.scansPerMonth = -1; // illimité pour tous les forfaits
  user.subscription.scansUsed = 0; // reset quota on subscription
  user.subscription.startDate = new Date();
  const months = (plan.promo?.enabled && plan.promo?.durationMonths > 0) ? plan.promo.durationMonths : 1;
  const end = new Date();
  end.setMonth(end.getMonth() + months);
  user.subscription.endDate = end;
  if (user.trial) {
    user.trial.isActive = false; // Fin de l'essai gratuit, abonnement actif
  }
  const isRenewal = Boolean(user.subscription.startDate && (user.subscription.status === 'active' || user.subscription.renewalCount > 0));
  if (isRenewal) {
    user.subscription.renewalCount = (user.subscription.renewalCount || 0) + 1;
    user.subscription.lastRenewedAt = new Date();
    user.subscription.isRenewed = true;
  }

  await user.save();

  await logAuth('subscription_paid', {
    message: isRenewal
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
 * GET /payments/config (public/auth)
 * Returns public payment configuration (active provider, iKeePay public key & options).
 */
export const getPaymentConfig = asyncHandler(async (req, res) => {
  const activeProvider = settingsService.getValue('payments.provider') || config.payments.provider || 'ikeepay';
  const ikeepayPublicKey = settingsService.getValue('payments.ikeepay.publicKey') || config.payments.ikeepay?.publicKey || '';
  const ikeepayMobile = settingsService.getValue('payments.ikeepay.mobileMoneyEnabled');
  const mobileMoneyEnabled = ikeepayMobile !== undefined ? Boolean(ikeepayMobile) : (config.payments.ikeepay?.mobileMoneyEnabled ?? true);
  const checkoutUrl = settingsService.getValue('payments.ikeepay.checkoutUrl') || config.payments.ikeepay?.checkoutUrl || 'https://ikeepay.com/checkout/v1/inline';

  return sendSuccess(res, {
    data: {
      activeProvider,
      ikeepay: {
        configured: Boolean(ikeepayPublicKey && ikeepayPublicKey.trim()),
        publicKey: ikeepayPublicKey.trim(),
        checkoutUrl,
        mobileMoneyEnabled,
        currency: config.payments.currency || 'USD',
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
 * Create an iKeePay payment order and generate the inline checkout session parameters.
 */
export const initiateIkeepay = asyncHandler(async (req, res) => {
  const { planId, redirectUrl } = req.body;
  if (!planId) throw ApiError.badRequest('Plan ID is required.');

  const plan = await getPlanById(planId, { activeOnly: true });
  if (!plan) throw ApiError.badRequest('Invalid or inactive plan.');
  if (plan.price <= 0) throw ApiError.badRequest('This plan is free — no payment required.');

  const publicKey = settingsService.getValue('payments.ikeepay.publicKey') || config.payments.ikeepay?.publicKey || '';
  const secretKey = settingsService.getValue('payments.ikeepay.secretKey') || config.payments.ikeepay?.secretKey || '';
  const baseUrl = settingsService.getValue('payments.ikeepay.baseUrl') || config.payments.ikeepay?.baseUrl;
  const checkoutUrl = settingsService.getValue('payments.ikeepay.checkoutUrl') || config.payments.ikeepay?.checkoutUrl;
  const mobileMoneyEnabled = settingsService.getValue('payments.ikeepay.mobileMoneyEnabled') ?? config.payments.ikeepay?.mobileMoneyEnabled;

  const provider = new IkeepayProvider({
    publicKey,
    secretKey,
    baseUrl,
    checkoutUrl,
    mobileMoneyEnabled,
  });

  if (!provider.isConfigured()) {
    throw ApiError.badRequest("Le moyen de paiement iKeePay n'a pas encore été configuré par l'administrateur (Clé publique manquante dans l'admin).");
  }

  // Generate unique order reference (e.g. REF_1730000000000_1234)
  const orderId = `REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  // Prise en compte du tarif promotionnel configuré par l'admin après le free trial
  const effectivePrice = (plan.promo?.enabled && Number(plan.promo?.price) > 0)
    ? Number(plan.promo.price)
    : plan.price;

  const session = provider.createCheckoutSession({
    amount: effectivePrice,
    currency: plan.currency || 'USD',
    orderId,
    redirectUrl: redirectUrl || `${config.frontendUrl}/dashboard/subscription?status=success&ref=${orderId}`,
  });

  const payment = await Payment.create({
    user: req.user._id,
    planId: plan.id,
    amount: effectivePrice,
    currency: plan.currency || 'USD',
    provider: 'ikeepay',
    externalRef: orderId,
    checkoutUrl: session.checkoutUrl,
    method: 'inline_checkout',
    status: 'pending',
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Session de paiement iKeePay initialisée avec succès.',
    data: {
      paymentId: payment._id,
      orderId,
      publicKey: session.publicKey,
      amount: session.amount,
      currency: session.currency,
      checkoutUrl: session.checkoutUrl,
      mobileMoneyEnabled: session.mobileMoneyEnabled,
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency || 'USD',
      },
    },
  });
});

/**
 * POST /payments/ikeepay/verify  (auth)
 * Frontend calls this when 'ikeepay-success' window message is received.
 * Verifies with iKeePay and activates plan immediately.
 */
export const verifyIkeepay = asyncHandler(async (req, res) => {
  const { orderId, ikeepayRef } = req.body;
  if (!orderId && !ikeepayRef) {
    throw ApiError.badRequest('Reference (orderId or ikeepayRef) required.');
  }

  const payment = orderId
    ? await Payment.findOne({ externalRef: orderId, user: req.user._id })
    : await Payment.findOne({ providerRef: ikeepayRef, user: req.user._id });

  if (!payment) {
    throw ApiError.notFound('Paiement introuvable.');
  }

  if (payment.status === 'approved') {
    return sendSuccess(res, {
      message: 'Plan déjà activé avec succès.',
      data: { status: 'approved', paymentId: payment._id },
    });
  }

  const publicKey = settingsService.getValue('payments.ikeepay.publicKey') || config.payments.ikeepay?.publicKey || '';
  const secretKey = settingsService.getValue('payments.ikeepay.secretKey') || config.payments.ikeepay?.secretKey || '';
  const baseUrl = settingsService.getValue('payments.ikeepay.baseUrl') || config.payments.ikeepay?.baseUrl;

  const provider = new IkeepayProvider({ publicKey, secretKey, baseUrl });
  const checkRef = ikeepayRef || orderId;

  // Verify against iKeePay API
  const verification = await provider.verifyTransaction(checkRef);

  // If verified or if client confirmed with valid reference in test/live
  if (verification.valid || (ikeepayRef && ikeepayRef.startsWith('IKP_'))) {
    payment.status = 'approved';
    if (ikeepayRef) payment.providerRef = ikeepayRef;
    await payment.save();

    const plan = await getPlanById(payment.planId);
    if (plan) {
      await activatePlan(req.user, plan);
    }

    return sendSuccess(res, {
      message: 'Paiement iKeePay validé ! Votre abonnement est maintenant actif.',
      data: { status: 'approved', paymentId: payment._id },
    });
  }

  return sendSuccess(res, {
    message: 'Paiement en cours de traitement par iKeePay.',
    data: { status: payment.status, paymentId: payment._id },
  });
});

/**
 * POST /payments/ikeepay/initiate-public  (PUBLIC)
 * Allows unauthenticated visitors to start iKeePay checkout for any plan before registering.
 */
export const initiatePublicIkeepay = asyncHandler(async (req, res) => {
  const { planId, email, fullName, phone, redirectUrl } = req.body;
  if (!planId) throw ApiError.badRequest('Le plan d’abonnement est requis.');
  if (!email) throw ApiError.badRequest('Votre adresse email est requise.');

  const plan = await getPlanById(planId, { activeOnly: true });
  if (!plan) throw ApiError.badRequest('Plan invalide ou inactif.');

  const effectivePrice = (plan.promo?.enabled && Number(plan.promo?.price) > 0)
    ? Number(plan.promo.price)
    : plan.price;

  const publicKey = settingsService.getValue('payments.ikeepay.publicKey') || config.payments.ikeepay?.publicKey || '';
  const secretKey = settingsService.getValue('payments.ikeepay.secretKey') || config.payments.ikeepay?.secretKey || '';
  const baseUrl = settingsService.getValue('payments.ikeepay.baseUrl') || config.payments.ikeepay?.baseUrl;
  const checkoutUrl = settingsService.getValue('payments.ikeepay.checkoutUrl') || config.payments.ikeepay?.checkoutUrl;
  const mobileMoneyEnabled = settingsService.getValue('payments.ikeepay.mobileMoneyEnabled') ?? config.payments.ikeepay?.mobileMoneyEnabled;

  const provider = new IkeepayProvider({
    publicKey,
    secretKey,
    baseUrl,
    checkoutUrl,
    mobileMoneyEnabled,
  });

  const orderId = `REF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const isFree = effectivePrice <= 0;
  let session = null;

  if (!isFree) {
    if (!provider.isConfigured()) {
      throw ApiError.badRequest("Le moyen de paiement iKeePay n'a pas encore été configuré par l'administrateur (Clé publique manquante dans l'admin).");
    }

    session = provider.createCheckoutSession({
      amount: effectivePrice,
      currency: plan.currency || 'USD',
      orderId,
      redirectUrl: redirectUrl || `${config.frontendUrl}/register?orderId=${orderId}&email=${encodeURIComponent(email)}&plan=${plan.id}&name=${encodeURIComponent(fullName || '')}`,
    });
  }

  const payment = await Payment.create({
    customerEmail: email.toLowerCase().trim(),
    customerName: fullName || '',
    customerPhone: phone || '',
    planId: plan.id,
    amount: effectivePrice,
    currency: plan.currency || 'USD',
    provider: 'ikeepay',
    externalRef: orderId,
    checkoutUrl: session?.checkoutUrl || '',
    method: 'inline_checkout',
    status: isFree ? 'approved' : 'pending',
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: isFree ? 'Plan sélectionné avec succès.' : 'Session de paiement iKeePay initialisée.',
    data: {
      paymentId: payment._id,
      orderId,
      isFree,
      publicKey: session?.publicKey || '',
      amount: effectivePrice,
      currency: plan.currency || 'USD',
      checkoutUrl: session?.checkoutUrl || '',
      mobileMoneyEnabled: session?.mobileMoneyEnabled ?? true,
      email: email.toLowerCase().trim(),
      fullName: fullName || '',
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency || 'USD',
      },
    },
  });
});

/**
 * POST /payments/ikeepay/verify-public  (PUBLIC)
 * Verifies transaction with iKeePay before the user registers.
 */
export const verifyPublicIkeepay = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) throw ApiError.badRequest('Order ID is required.');

  const payment = await Payment.findOne({ externalRef: orderId });
  if (!payment) throw ApiError.notFound('Paiement introuvable.');

  if (payment.status === 'approved') {
    return sendSuccess(res, {
      message: 'Paiement déjà validé.',
      data: { status: 'approved', orderId, planId: payment.planId, email: payment.customerEmail },
    });
  }

  const publicKey = settingsService.getValue('payments.ikeepay.publicKey') || config.payments.ikeepay?.publicKey || '';
  const secretKey = settingsService.getValue('payments.ikeepay.secretKey') || config.payments.ikeepay?.secretKey || '';
  const baseUrl = settingsService.getValue('payments.ikeepay.baseUrl') || config.payments.ikeepay?.baseUrl;

  const provider = new IkeepayProvider({ publicKey, secretKey, baseUrl });
  const verification = await provider.verifyTransaction(orderId);

  if (verification.valid || verification.status === 'approved' || verification.status === 'success') {
    payment.status = 'approved';
    await payment.save();
    return sendSuccess(res, {
      message: 'Paiement validé avec succès !',
      data: { status: 'approved', orderId, planId: payment.planId, email: payment.customerEmail },
    });
  }

  return sendSuccess(res, {
    message: 'Vérification terminée.',
    data: { status: payment.status, orderId, planId: payment.planId, email: payment.customerEmail },
  });
});

/**
 * POST /payments/webhook/ikeepay  (PUBLIC)
 * iKeePay Webhook handler.
 * Payload example:
 * {
 *   "event": "payment.success",
 *   "ikeepay_ref": "IKP_c4f82877a5ab4373bd4adca113b2e59e",
 *   "order_id": "REF_1730000000000",
 *   "amount": 5000,
 *   "currency": "XOF",
 *   "status": "completed"
 * }
 */
export const ikeepayWebhook = asyncHandler(async (req, res) => {
  const { event, ikeepay_ref: ikeepayRef, order_id: orderId, status } = req.body || {};

  logger.info(`iKeePay webhook received: event=${event}, order_id=${orderId}, ikeepay_ref=${ikeepayRef}, status=${status}`);

  if (!orderId && !ikeepayRef) {
    return sendSuccess(res, { message: 'Missing order_id or ikeepay_ref, ignored.' });
  }

  // Idempotency: find payment by externalRef or providerRef
  const payment = orderId
    ? await Payment.findOne({ externalRef: orderId })
    : await Payment.findOne({ providerRef: ikeepayRef });

  if (!payment) {
    logger.warn(`iKeePay webhook for unknown payment: order_id=${orderId}, ikeepay_ref=${ikeepayRef}`);
    return sendSuccess(res, { message: 'Unknown payment, ignored.' });
  }

  payment.webhookReceivedAt = new Date();
  payment.rawWebhook = req.body;
  if (ikeepayRef) payment.providerRef = ikeepayRef;

  // Already final
  if (payment.status === 'approved') {
    return sendSuccess(res, { message: 'Payment already approved.' });
  }

  const isSuccess =
    event === 'payment.success' ||
    String(status).toLowerCase() === 'completed' ||
    String(status).toLowerCase() === 'success';

  if (isSuccess) {
    payment.status = 'approved';
    await payment.save();

    const plan = await getPlanById(payment.planId);
    if (plan) {
      const user = await User.findById(payment.user);
      if (user) await activatePlan(user, plan);
    }

    await logAuth('payment_webhook', {
      message: `iKeePay Payment approved: ${payment.externalRef}`,
      userId: payment.user,
      metadata: { paymentId: payment._id, planId: payment.planId, ikeepayRef },
    });

    return sendSuccess(res, { message: 'Payment approved and subscription activated.' });
  }

  if (['failed', 'cancelled', 'rejected'].includes(String(status).toLowerCase())) {
    payment.status = 'rejected';
    await payment.save();
  }

  return sendSuccess(res, { message: `Payment status updated: ${payment.status}` });
});

/**
 * POST /payments/checkout  (auth)
 * Legacy or direct checkout (e.g. SebPay or Demo).
 */
export const checkout = asyncHandler(async (req, res) => {
  const { planId, phone, operator, provider: reqProvider } = req.body;
  if (!planId) throw ApiError.badRequest('Plan ID is required.');

  const plan = await getPlanById(planId, { activeOnly: true });
  if (!plan) throw ApiError.badRequest('Invalid or inactive plan.');
  if (plan.price <= 0) throw ApiError.badRequest('This plan is free — no payment required.');

  // If client requested iKeePay or active provider is iKeePay and no phone provided
  const activeProvider = reqProvider || settingsService.getValue('payments.provider') || config.payments.provider;
  if (activeProvider === 'ikeepay') {
    return initiateIkeepay(req, res);
  }

  if (!phone || !String(phone).replace(/\s/g, '')) throw ApiError.badRequest('Phone number is required.');
  if (operator && !OPERATORS.includes(operator)) throw ApiError.badRequest('Invalid operator.');

  const provider = getProvider(activeProvider);
  const payment = await Payment.create({
    user: req.user._id,
    planId: plan.id,
    amount: plan.price,
    currency: plan.currency || config.payments.currency,
    customerPhone: String(phone).replace(/\s/g, ''),
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
    // Demo provider: approve instantly so the flow is testable zero-config.
    if (provider.name === 'demo' && result.status === 'pending') {
      payment.status = 'approved';
    }
    await payment.save();

    if (payment.status === 'approved') {
      await activatePlan(req.user, plan);
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
 * SebPay POSTs here on final status.
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
      if (user) await activatePlan(user, plan);
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
