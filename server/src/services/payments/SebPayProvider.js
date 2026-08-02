import crypto from 'crypto';
import { BasePaymentProvider } from './BasePaymentProvider.js';

/**
 * SebPay Mobile Money provider (https://new.sebpay.bj).
 *
 * Collection flow:
 *  1. POST a collection → customer gets a validation prompt on their phone.
 *  2. SebPay POSTs a webhook to `callback_url` on the final status, signed with
 *     HMAC-SHA256 (header `X-SebPay-Signature`) using the secret key (sk_...).
 *
 * NOTE: the exact collection endpoint path and request field names are
 * confirmed from the SebPay dashboard/docs. They are centralized here (ENDPOINT
 * + the createCollection body) so only this file changes if they differ.
 */
export const SEBPAY_SIGNATURE_HEADER = 'x-sebpay-signature';

export class SebPayProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'sebpay';
    this.publicKey = config.publicKey;
    this.secretKey = config.secretKey;
    this.baseUrl = (config.baseUrl || 'https://new.sebpay.bj/api').replace(/\/$/, '');
    this.callbackUrl = config.callbackUrl;
  }

  isConfigured() {
    return Boolean(this.secretKey && this.publicKey);
  }

  async createCollection({ amount, currency, phone, operator, externalRef, description }) {
    const res = await fetch(`${this.baseUrl}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.secretKey}`,
        'X-Public-Key': this.publicKey,
      },
      body: JSON.stringify({
        amount,
        currency,
        customer_phone: phone,
        operator, // e.g. 'mtn' | 'moov'
        external_reference: externalRef,
        description,
        callback_url: this.callbackUrl,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`SebPay collection error (${res.status}): ${raw.message || JSON.stringify(raw)}`);
    }

    return {
      providerRef: raw.transaction_id || raw.id || null,
      status: this.normalizeStatus(raw.status || 'pending'),
      raw,
    };
  }

  /**
   * Verify the HMAC-SHA256 signature of a webhook body.
   * Uses a timing-safe comparison to avoid leaking the signature.
   */
  verifyWebhook(rawBody, signature) {
    if (!this.secretKey || !signature) return false;
    const expected = crypto.createHmac('sha256', this.secretKey).update(rawBody, 'utf8').digest('hex');
    const provided = String(signature).trim();
    // Compare in constant time; lengths must match for timingSafeEqual.
    if (provided.length !== expected.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  normalizeStatus(providerStatus) {
    const s = String(providerStatus || '').toLowerCase();
    // SebPay statuses: SUCCESS / FAILED / PENDING (+ approved/rejected in webhooks).
    if (['success', 'approved'].includes(s)) return 'approved';
    if (['failed', 'rejected', 'cancelled', 'canceled', 'expired'].includes(s)) return 'rejected';
    return 'pending';
  }
}
