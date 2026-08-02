import { BasePaymentProvider } from './BasePaymentProvider.js';

/**
 * Demo payment provider — the zero-config default.
 *
 * Returns a synthetic providerRef and a status of 'pending' that is
 * immediately resolvable: the payment controller treats demo payments as
 * approved instantly so the full checkout flow works without a SebPay account.
 * Never use in production (guarded by PAYMENT_PROVIDER).
 */
export class DemoPaymentProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'demo';
  }

  isConfigured() {
    return true; // always available
  }

  async createCollection({ amount, currency, phone, externalRef, description }) {
    // Simulate network latency.
    await new Promise((r) => setTimeout(r, 350));
    return {
      providerRef: `demo_${Date.now()}`,
      status: 'pending',
      raw: { demo: true, externalRef, amount, currency, phone, description },
    };
  }

  verifyWebhook() {
    return true; // demo — nothing to verify
  }
}
