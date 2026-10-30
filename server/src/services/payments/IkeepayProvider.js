import { BasePaymentProvider } from './BasePaymentProvider.js';
import logger from '../../config/logger.js';

/**
 * iKeePay Payment Provider (https://ikeepay.com)
 *
 * Supports:
 * - Inline Checkout Iframe (https://ikeepay.com/checkout/v1/inline)
 * - Mobile Money (MTN, Moov, Orange, Wave...) & Credit/Debit Cards
 * - Webhook notifications on payment completion
 * - Transaction verification endpoint: GET https://api.ikeepay.com/checkout-verify/:reference
 */
export class IkeepayProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'ikeepay';
    this.publicKey = config.publicKey || '';
    this.secretKey = config.secretKey || '';
    this.baseUrl = (config.baseUrl || 'https://api.ikeepay.com').replace(/\/$/, '');
    this.checkoutUrl = config.checkoutUrl || 'https://ikeepay.com/checkout/v1/inline';
    this.mobileMoneyEnabled = config.mobileMoneyEnabled !== false;
  }

  /**
   * Provider is configured if a public key is set.
   * Both test (pk_test_...) and live (pk_live_...) keys are supported.
   */
  isConfigured() {
    return Boolean(this.publicKey && this.publicKey.trim().length > 0);
  }

  /**
   * Generates inline checkout parameters and URL for frontend iframe.
   *
   * @param {Object} params
   * @param {number|string} params.amount
   * @param {string} params.currency - e.g. 'USD', 'XOF'
   * @param {string} params.orderId - unique reference (e.g. REF_1730000000000)
   * @param {string} [params.redirectUrl] - optional redirect target
   * @returns {{ checkoutUrl: string, publicKey: string, orderId: string, amount: number, currency: string }}
   */
  createCheckoutSession({ amount, currency = 'USD', orderId, redirectUrl }) {
    if (!this.isConfigured()) {
      throw new Error('iKeePay is not configured. Public key missing in admin settings.');
    }

    const params = new URLSearchParams({
      pk: this.publicKey.trim(),
      amount: String(amount),
      currency: String(currency).toUpperCase(),
      order_id: String(orderId),
    });

    if (redirectUrl) {
      params.set('redirect_url', redirectUrl);
    }

    const checkoutUrl = `${this.checkoutUrl}?${params.toString()}`;

    return {
      checkoutUrl,
      publicKey: this.publicKey.trim(),
      orderId: String(orderId),
      amount: Number(amount),
      currency: String(currency).toUpperCase(),
      mobileMoneyEnabled: this.mobileMoneyEnabled,
    };
  }

  /**
   * Fallback for direct createCollection calls.
   */
  async createCollection({ amount, currency, phone, operator, externalRef, description }) {
    const session = this.createCheckoutSession({
      amount,
      currency,
      orderId: externalRef,
    });

    return {
      providerRef: null,
      status: 'pending',
      checkoutUrl: session.checkoutUrl,
      raw: session,
    };
  }

  /**
   * Verify a transaction with the iKeePay verification API.
   * GET https://api.ikeepay.com/checkout-verify/:reference
   *
   * @param {string} reference - either ikeepay_ref (IKP_...) or order_id (REF_...)
   * @returns {Promise<{ valid: boolean, status: string, data: object, message?: string }>}
   */
  async verifyTransaction(reference) {
    if (!reference) {
      return { valid: false, status: 'unknown', message: 'No reference provided.' };
    }

    try {
      const headers = {
        Accept: 'application/json',
      };

      if (this.secretKey && this.secretKey.trim()) {
        const key = this.secretKey.trim();
        headers.Authorization = `Bearer ${key}`;
        headers['x-api-key'] = key;
      }

      const url = `${this.baseUrl}/checkout-verify/${encodeURIComponent(reference)}`;
      logger.info(`iKeePay: Verifying transaction at ${url}`);

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const rawStatus = data.status || (data.success ? 'completed' : 'pending');
        const normalized = this.normalizeStatus(rawStatus);
        const isApproved = normalized === 'approved';

        return {
          valid: isApproved,
          status: normalized,
          rawStatus,
          data,
        };
      }

      return {
        valid: false,
        status: 'pending',
        rawStatus: data.status,
        message: data.message || `HTTP ${res.status}`,
        data,
      };
    } catch (err) {
      logger.warn(`iKeePay verifyTransaction network error: ${err.message}`);
      return {
        valid: false,
        status: 'pending',
        error: err.message,
      };
    }
  }

  /**
   * Normalize iKeePay status into internal representation:
   * 'completed' | 'success' | 'paid' | 'approved' -> 'approved'
   * 'failed' | 'rejected' | 'cancelled' | 'canceled' | 'expired' -> 'rejected'
   * other -> 'pending'
   */
  normalizeStatus(providerStatus) {
    const s = String(providerStatus || '').toLowerCase().trim();
    if (['completed', 'success', 'successful', 'approved', 'paid'].includes(s)) {
      return 'approved';
    }
    if (['failed', 'rejected', 'cancelled', 'canceled', 'expired', 'error'].includes(s)) {
      return 'rejected';
    }
    return 'pending';
  }
}

export default IkeepayProvider;
