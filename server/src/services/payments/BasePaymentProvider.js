/**
 * Abstract base for a payment provider. Keeps the rest of the app decoupled
 * from any specific gateway — swapping SebPay for another Mobile Money
 * aggregator only touches a subclass.
 */
export class BasePaymentProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  /** @returns {boolean} whether the provider has the credentials it needs. */
  isConfigured() {
    return false;
  }

  /**
   * Initiate a Mobile Money collection. The customer then approves on their
   * phone; the final result arrives via webhook.
   * @param {Object} params
   * @param {number} params.amount
   * @param {string} params.currency
   * @param {string} params.phone - customer MSISDN
   * @param {string} params.operator - e.g. 'mtn' | 'moov'
   * @param {string} params.externalRef - our reference (Payment._id)
   * @param {string} params.description
   * @returns {Promise<{ providerRef: string, status: string, raw: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async createCollection(params) {
    throw new Error('createCollection() must be implemented by the provider');
  }

  /**
   * Verify a webhook's authenticity.
   * @param {string} rawBody - the raw JSON string as received
   * @param {string} signature - value of the provider's signature header
   * @returns {boolean}
   */
  // eslint-disable-next-line no-unused-vars
  verifyWebhook(rawBody, signature) {
    return false;
  }

  /**
   * Map a provider-specific status to our canonical status.
   * @param {string} providerStatus
   * @returns {'pending'|'approved'|'rejected'}
   */
  normalizeStatus(providerStatus) {
    const s = String(providerStatus || '').toLowerCase();
    if (['approved', 'success', 'successful', 'completed'].includes(s)) return 'approved';
    if (['rejected', 'failed', 'cancelled', 'canceled', 'expired'].includes(s)) return 'rejected';
    return 'pending';
  }
}
