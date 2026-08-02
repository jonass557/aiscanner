/**
 * Subscription plan definitions — the single source of truth for pricing,
 * scan limits, and feature lists. Used by the subscription logic, the admin
 * panel, and the pricing section of the landing page (via the API).
 *
 * scansPerMonth: -1 means unlimited.
 */
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    scansPerMonth: 5,
    features: [
      '5 scans per month',
      'Basic technical analysis',
      '7-day history retention',
      'PDF export',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    currency: 'USD',
    scansPerMonth: 100,
    features: [
      '100 scans per month',
      'Advanced SMC analysis',
      'Unlimited history',
      'PDF + CSV export',
      'Priority support',
      'Email alerts',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 99,
    currency: 'USD',
    scansPerMonth: -1,
    features: [
      'Unlimited scans',
      'Everything in Pro',
      'API access',
      'Real-time analysis',
      '24/7 support',
      'Custom reports',
    ],
  },
};

export const getPlan = (planId) => PLANS[planId] || PLANS.free;

export const PLAN_IDS = Object.keys(PLANS);
