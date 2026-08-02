import crypto from 'crypto';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { getPlanById } from '../services/planService.js';
import { getProvider, SEBPAY_SIGNATURE_HEADER } from '../services/payments/index.js';
import { logAuth } from '../services/logService.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

const OPERATORS = ['mtn', 'moov'];

/**
 * POST /payments/checkout  (auth)
 * Initiate a Mobile Money collection for a plan.
 */
export const checkout = asyncHandler(async (req, res) => {
  const { planId, phone, operator } = req.body;
  if (!planId) throw ApiError.badRequest('Plan id is required.');
  if (!phone || !String(phone).replace(/\s/g, '')) throw ApiError.badRequest('Phone number is required.');
  if (!OPERATORS.includes(operator)) throw ApiError.badRequest('Operator must be "mtn" or "moov".');

  const plan = await getPlanById(planId, { activeOnly: true });
  if (!plan) throw ApiError.badRequest('Invalid or inactive plan.');
  if (plan.price <= 0) throw ApiError.badRequest('This plan is free — no payment required.');

  const provider = getProvider();
  const payment = await Payment.create({
    user: req.user._id,
    planId: plan.id,
    amount: plan.price,
    currency: plan.currency || config.payments.currency,
    customerPhone: String(phone).replace(/\s/g, ''),
    operator,
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
    throw ApiError.internal('Impossible d\'initier le paiement. Réessayez.');
  }
});

/**
 * Apply a paid plan to a user (shared by checkout + webhook).
 */
const activatePlan = async (user, plan) => {
  user.subscription.plan = plan.id;
  user.subscription.status = 'active';
  user.subscription.scansPerMonth = plan.scansPerMonth;
  user.subscription.startDate = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  user.subscription.endDate = end;
  await user.save();
  await logAuth('subscription_paid', {
    message: `Paid subscription activated: ${plan.name}`,
    userId: user._id,
    metadata: { planId: plan.id },
  });
};

/**
 * POST /payments/webhook/sebpay  (PUBLIC)
 * SebPay POSTs here on final status. Verifies the HMAC-SHA256 signature,
 * then idempotently updates the payment and activates the plan on SUCCESS.
 */
export const webhook = asyncHandler(async (req, res) => {
  // Raw body is needed for HMAC; express.json() already gave us req.body, but
  // we re-hash the exact bytes. To be robust, trust req.body if raw is absent.
  const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
  const signature = req.headers[SEBPAY_SIGNATURE_HEADER];

  const provider = getProvider();
  if (provider.name === 'sebpay') {
    if (!provider.verifyWebhook(rawBody, signature)) {
      throw ApiError.unauthorized('Invalid webhook signature.');
    }
  }

  const { transaction_id: transactionId, external_reference: externalRef, status } = req.body || {};

  // Idempotency: look up the payment by either the provider ref or our ref.
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

  // Already final — skip (webhooks can be retried).
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
