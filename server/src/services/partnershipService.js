import PartnershipConfig from '../models/PartnershipConfig.js';
import PartnerCommission from '../models/PartnerCommission.js';
import User from '../models/User.js';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { IkeepayProvider } from './payments/index.js';
import * as settingsService from './settings/settingsService.js';

/**
 * Retrieve (or bootstrap) the singleton PartnershipConfig document.
 */
export const getOrCreatePartnershipConfig = async () => {
  let doc = await PartnershipConfig.findOne({ key: 'default' });
  if (!doc) {
    doc = await PartnershipConfig.create({ key: 'default' });
  }
  return doc;
};

/**
 * Build an IkeepayProvider instance using dynamic admin settings + env fallback.
 */
export const getConfiguredIkeepayProvider = () => {
  const publicKey = settingsService.getValue('payments.ikeepay.publicKey') || config.payments.ikeepay?.publicKey || '';
  const secretKey = settingsService.getValue('payments.ikeepay.secretKey') || config.payments.ikeepay?.secretKey || '';
  const baseUrl = settingsService.getValue('payments.ikeepay.baseUrl') || config.payments.ikeepay?.baseUrl || 'https://api.ikeepay.com';
  const mobileMoneyEnabled = settingsService.getValue('payments.ikeepay.mobileMoneyEnabled') ?? config.payments.ikeepay?.mobileMoneyEnabled;

  return new IkeepayProvider({
    publicKey,
    secretKey,
    baseUrl,
    mobileMoneyEnabled,
  });
};

/**
 * Resolve plan duration in months (supports monthly, bimonthly, quarterly, semi-annual, annual).
 */
export const resolvePlanDurationMonths = (planOrId) => {
  const id = String(typeof planOrId === 'string' ? planOrId : planOrId?.id || '').toLowerCase();
  if (id.includes('1an') || id.includes('12mois') || id.includes('annual') || id.includes('annuel')) return 12;
  if (id.includes('6mois') || id.includes('semestr')) return 6;
  if (id.includes('3mois') || id.includes('trimestr') || id.includes('quarter')) return 3;
  if (id.includes('2mois')) return 2;
  const promoDur = typeof planOrId === 'object' ? Number(planOrId?.promo?.durationMonths || 0) : 0;
  if (promoDur > 0) return promoDur;
  return 1;
};

/**
 * Count active VIP partners currently occupying spots in the program.
 */
export const countActivePartners = async () => {
  return User.countDocuments({
    'partnership.isActive': true,
    'partnership.status': 'active',
  });
};

/**
 * Grant / activate lifetime Partner benefits on a user document.
 */
export const activatePartnershipForUser = async (user, { fullName, email, phone, paymentRef, paidAmount } = {}) => {
  if (!user.partnership) user.partnership = {};

  user.partnership.isActive = true;
  user.partnership.status = 'active';
  if (!user.partnership.joinedAt) {
    user.partnership.joinedAt = new Date();
  }
  user.partnership.lifetimeAccess = true;
  user.partnership.formSubmitted = true;
  user.partnership.formSubmittedAt = new Date();
  if (fullName) user.partnership.fullName = String(fullName).trim();
  if (email) user.partnership.email = String(email).toLowerCase().trim();
  if (phone) user.partnership.phone = String(phone).trim();
  if (paymentRef) user.partnership.paymentRef = paymentRef;
  if (paidAmount !== undefined) user.partnership.paidAmount = Number(paidAmount) || 0;
  user.partnership.excludedAt = null;
  user.partnership.excludedReason = '';

  // Also ensure full platform access even if they had a free or expiring plan
  if (!user.subscription) user.subscription = {};
  user.subscription.status = 'active';
  user.subscription.scansPerMonth = -1;
  if (!user.subscription.plan || user.subscription.plan === 'free') {
    user.subscription.plan = 'partner_lifetime';
  }
  if (user.trial) {
    user.trial.isActive = false;
  }

  await user.save();
  return user;
};

/**
 * Release any `scheduled` (period_end) commissions whose periodEnd has arrived.
 */
export const releaseDueScheduledCommissions = async () => {
  const now = new Date();
  const dueList = await PartnerCommission.find({
    status: 'scheduled',
    periodEnd: { $lte: now },
  });

  if (!dueList.length) return 0;

  const cfg = await getOrCreatePartnershipConfig();
  let released = 0;

  for (const comm of dueList) {
    const partner = await User.findById(comm.partner);
    if (partner && partner.partnership?.isActive && partner.partnership?.status === 'active') {
      partner.partnership.balance = (partner.partnership.balance || 0) + comm.partnerAmount;
      partner.partnership.totalEarned = (partner.partnership.totalEarned || 0) + comm.partnerAmount;
      await partner.save();
    }

    cfg.adminPoolBalance = (cfg.adminPoolBalance || 0) + comm.adminAmount;
    cfg.adminPoolTotalEarned = (cfg.adminPoolTotalEarned || 0) + comm.adminAmount;

    comm.status = 'credited';
    comm.creditedAt = now;
    await comm.save();
    released += 1;
  }

  await cfg.save();
  return released;
};

/**
 * Compute and apply the Partner (e.g. 30%) / Admin (e.g. 70%) revenue split
 * whenever an affiliated user's subscription payment succeeds.
 * Returns true if handled as a Partner split, false otherwise.
 */
export const processPartnerCommissionSplit = async ({ subscriber, payment, plan, paidAmount }) => {
  if (!subscriber?.referredBy) return false;
  if (payment?.splitApplied || payment?.purpose === 'partnership') return false;

  const partner = await User.findById(subscriber.referredBy);
  if (!partner || !partner.partnership?.isActive || partner.partnership?.status !== 'active') {
    return false;
  }

  const existing = payment?._id ? await PartnerCommission.findOne({ payment: payment._id }) : null;
  if (existing) return true;

  const cfg = await getOrCreatePartnershipConfig();
  if (cfg.isDeleted) return false;

  const partnerRate = Math.max(1, Math.min(95, Number(cfg.commissionRate || 30)));
  const adminRate = 100 - partnerRate;

  const gross = Math.max(0, Number(paidAmount ?? payment?.amount ?? plan?.price ?? 0));
  if (gross <= 0) return false;

  const partnerAmount = Math.round(gross * (partnerRate / 100));
  const adminAmount = Math.max(0, Math.round(gross) - partnerAmount);

  const months = resolvePlanDurationMonths(plan || payment?.planId);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + months);

  const isImmediate = (cfg.creditTiming || 'instant') === 'instant';

  const commission = await PartnerCommission.create({
    partner: partner._id,
    referredUser: subscriber._id,
    payment: payment?._id,
    planId: plan?.id || payment?.planId || 'subscription',
    planName: plan?.name || payment?.planId || 'Abonnement',
    subscriptionMonths: months,
    periodStart,
    periodEnd,
    grossAmount: gross,
    currency: payment?.currency || cfg.currency || 'XOF',
    partnerRate,
    partnerAmount,
    adminRate,
    adminAmount,
    status: isImmediate ? 'credited' : 'scheduled',
    creditedAt: isImmediate ? new Date() : null,
  });

  if (isImmediate) {
    partner.partnership.balance = (partner.partnership.balance || 0) + partnerAmount;
    partner.partnership.totalEarned = (partner.partnership.totalEarned || 0) + partnerAmount;
    partner.partnership.lastAffiliateAt = new Date();
    await partner.save();

    cfg.adminPoolBalance = (cfg.adminPoolBalance || 0) + adminAmount;
    cfg.adminPoolTotalEarned = (cfg.adminPoolTotalEarned || 0) + adminAmount;
    await cfg.save();
  }

  if (payment) {
    payment.splitApplied = true;
    payment.partnerShare = partnerAmount;
    payment.adminShare = adminAmount;
    payment.referredByPartner = partner._id;
    await payment.save();
  }

  logger.info(
    `Partner commission split: ${partnerAmount} (${partnerRate}%) -> Partner ${partner.email} | ${adminAmount} (${adminRate}%) -> Admin [${commission.status}]`
  );
  return true;
};

/**
 * Check if an active partner had 0 new affiliates during the last 30 days.
 */
export const isPartnerInactiveMonthly = async (partnerDoc) => {
  if (!partnerDoc?.partnership?.joinedAt) return false;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const joinedAgeMs = now - new Date(partnerDoc.partnership.joinedAt).getTime();
  if (joinedAgeMs < thirtyDaysMs) return false; // Grace period during first 30 days

  const windowStart = new Date(now - thirtyDaysMs);
  const recentAffiliates = await User.countDocuments({
    referredBy: partnerDoc._id,
    createdAt: { $gte: windowStart },
  });
  return recentAffiliates === 0;
};
