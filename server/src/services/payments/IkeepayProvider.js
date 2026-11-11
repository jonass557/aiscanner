import crypto from 'crypto';
import { BasePaymentProvider } from './BasePaymentProvider.js';
import logger from '../../config/logger.js';

export const IKEEPAY_SIGNATURE_HEADER = 'x-ikeepay-signature';

/**
 * Supported countries & operators for iKeePay H2H API.
 */
export const IKEEPAY_H2H_COUNTRIES = [
  { code: 'CI', name: "Côte d'Ivoire", dial: '225', currency: 'XOF', operators: ['ORANGE', 'MTN', 'MOOV', 'WAVE'] },
  { code: 'SN', name: 'Sénégal', dial: '221', currency: 'XOF', operators: ['ORANGE', 'WAVE', 'FREE', 'EMONEY'] },
  { code: 'BF', name: 'Burkina Faso', dial: '226', currency: 'XOF', operators: ['ORANGE', 'MOOV', 'MOBICASH'] },
  { code: 'BJ', name: 'Bénin', dial: '229', currency: 'XOF', operators: ['MTN', 'MOOV'] },
  { code: 'TG', name: 'Togo', dial: '228', currency: 'XOF', operators: ['TMONEY', 'MOOV'] },
  { code: 'ML', name: 'Mali', dial: '223', currency: 'XOF', operators: ['ORANGE', 'MOOV', 'MOBICASH'] },
  { code: 'CM', name: 'Cameroun', dial: '237', currency: 'XAF', operators: ['ORANGE', 'MTN'] },
  { code: 'CG', name: 'Congo-Brazzaville', dial: '242', currency: 'XAF', operators: ['MTN', 'AIRTEL'] },
  { code: 'GA', name: 'Gabon', dial: '241', currency: 'XAF', operators: ['AIRTEL', 'MOBICASH'] },
  { code: 'CD', name: 'RD Congo', dial: '243', currency: 'USD', operators: ['AIRTEL', 'ORANGE', 'VODACOM', 'MPESA'] },
  { code: 'NE', name: 'Niger', dial: '227', currency: 'XOF', operators: ['AIRTEL', 'MOOV', 'ORANGE'] },
];

/**
 * Normalize phone number into digits with country dial prefix (e.g. 2250700000000).
 */
export const normalizeH2HPhone = (phone, countryCode = 'CI') => {
  let digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  const upperCode = String(countryCode || '').toUpperCase();
  const entry = IKEEPAY_H2H_COUNTRIES.find((c) => c.code === upperCode);
  if (entry && !digits.startsWith(entry.dial) && digits.length <= 10) {
    const localPart = upperCode === 'CD' ? digits.replace(/^0+/, '') : digits;
    return `${entry.dial}${localPart}`;
  }
  return digits;
};

/**
 * iKeePay H2H Payment Provider (https://api.ikeepay.com)
 *
 * Implements the official Host-to-Host (H2H) REST API:
 * - Auth header: x-api-key: SECRET_KEY
 * - Payin:   POST /h2h-payin
 * - Payout:  POST /h2h-payout
 * - Verify:  GET /h2h-verify/:reference
 * - Webhook: HMAC SHA-256 signature verification via X-Ikeepay-Signature
 */
export class IkeepayProvider extends BasePaymentProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'ikeepay';
    this.publicKey = config.publicKey || '';
    this.secretKey = config.secretKey || '';
    this.baseUrl = (config.baseUrl || 'https://api.ikeepay.com').replace(/\/$/, '');
    this.mobileMoneyEnabled = config.mobileMoneyEnabled !== false;
  }

  /**
   * Provider is configured when the iKeePay H2H secret key (`x-api-key`) is present.
   */
  isConfigured() {
    return Boolean(this.secretKey && this.secretKey.trim().length > 0);
  }

  _buildHeaders(extra = {}) {
    const key = (this.secretKey || '').trim();
    if (!key) {
      throw new Error("La clé secrète iKeePay (x-api-key) n'est pas configurée dans l'administration.");
    }
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': key,
      ...extra,
    };
  }

  /**
   * 1. Encaissement (Payin) — POST /h2h-payin
   *
   * @param {Object} params
   * @param {number} params.amount
   * @param {string} params.currency - e.g. 'XOF', 'XAF', 'USD'
   * @param {string} params.country - ISO-2 country code e.g. 'CI'
   * @param {string} params.phoneNumber - MSISDN e.g. '2250700000000'
   * @param {string} params.operator - e.g. 'ORANGE', 'MTN', 'WAVE', 'MOOV', 'MOBICASH', 'AIRTEL', 'VODACOM'
   * @param {string} params.external_reference - unique REF_...
   * @param {string} params.customer_email
   * @param {string} [params.otp] - optional (required for e.g. ORANGE BF)
   */
  async initiatePayin({
    amount,
    currency = 'XOF',
    country = 'CI',
    phoneNumber,
    operator = 'ORANGE',
    external_reference,
    customer_email,
    otp,
  }) {
    const upperCountry = String(country || 'CI').toUpperCase().trim();
    const upperOperator = String(operator || 'ORANGE').toUpperCase().trim();
    const cleanPhone = normalizeH2HPhone(phoneNumber, upperCountry);
    let finalAmount = Math.round(Number(amount));

    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('Numéro de téléphone Mobile Money invalide.');
    }

    // Burkina Faso rule from iKeePay doc: multiple de 100
    if (upperCountry === 'BF' && finalAmount % 100 !== 0) {
      finalAmount = Math.ceil(finalAmount / 100) * 100;
    }

    const payload = {
      amount: finalAmount,
      currency: String(currency || 'XOF').toUpperCase().trim(),
      country: upperCountry,
      phoneNumber: cleanPhone,
      operator: upperOperator,
      external_reference: String(external_reference),
      customer_email: String(customer_email || '').trim().toLowerCase(),
    };

    if (otp && String(otp).trim()) {
      payload.otp = String(otp).trim();
    }

    const url = `${this.baseUrl}/h2h-payin`;
    logger.info(`iKeePay H2H Payin -> ${url} ref=${payload.external_reference} op=${upperOperator} country=${upperCountry}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: this._buildHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || `Erreur iKeePay H2H Payin (HTTP ${res.status})`;
      logger.error(`iKeePay H2H Payin failed: ${msg}`, { status: res.status, data });
      throw new Error(msg);
    }

    const inner = data?.data && typeof data.data === 'object' ? data.data : data;
    const providerRef = inner.provider_reference || data.provider_reference || null;
    const paymentLink = inner.payment_link || data.payment_link || inner.checkout_url || data.checkout_url || '';
    const rawStatus = inner.status || (data.status === 'success' ? 'pending' : data.status) || 'pending';

    return {
      providerRef,
      externalRef: payload.external_reference,
      paymentLink,
      status: this.normalizeStatus(rawStatus),
      rawStatus,
      raw: data,
    };
  }

  /**
   * BasePaymentProvider compatibility wrapper around initiatePayin.
   */
  async createCollection({ amount, currency, country = 'CI', phone, operator, externalRef, customerEmail, otp }) {
    const result = await this.initiatePayin({
      amount,
      currency,
      country,
      phoneNumber: phone,
      operator,
      external_reference: externalRef,
      customer_email: customerEmail,
      otp,
    });

    return {
      providerRef: result.providerRef,
      status: result.status,
      checkoutUrl: result.paymentLink || '',
      paymentLink: result.paymentLink || '',
      raw: result.raw,
    };
  }

  /**
   * 2. Retrait (Payout) — POST /h2h-payout
   *
   * @param {Object} params
   * @param {number} params.amount
   * @param {string} params.currency
   * @param {string} params.country
   * @param {string} params.phoneNumber
   * @param {string} params.operator
   * @param {string} params.external_reference
   */
  async initiatePayout({
    amount,
    currency = 'XOF',
    country = 'CI',
    phoneNumber,
    operator = 'ORANGE',
    external_reference,
  }) {
    const upperCountry = String(country || 'CI').toUpperCase().trim();
    const upperOperator = String(operator || 'ORANGE').toUpperCase().trim();
    const cleanPhone = normalizeH2HPhone(phoneNumber, upperCountry);
    let finalAmount = Math.round(Number(amount));

    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('Numéro de téléphone Mobile Money invalide pour le retrait.');
    }

    if (upperCountry === 'BF' && finalAmount % 100 !== 0) {
      finalAmount = Math.floor(finalAmount / 100) * 100;
    }

    const payload = {
      amount: finalAmount,
      currency: String(currency || 'XOF').toUpperCase().trim(),
      country: upperCountry,
      phoneNumber: cleanPhone,
      operator: upperOperator,
      external_reference: String(external_reference),
    };

    const url = `${this.baseUrl}/h2h-payout`;
    logger.info(`iKeePay H2H Payout -> ${url} ref=${payload.external_reference} op=${upperOperator} amount=${finalAmount} ${payload.currency}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: this._buildHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.message || data?.error || `Erreur iKeePay H2H Payout (HTTP ${res.status})`;
      logger.error(`iKeePay H2H Payout failed: ${msg}`, { status: res.status, data });
      throw new Error(msg);
    }

    const inner = data?.data && typeof data.data === 'object' ? data.data : data;
    const providerRef = inner.provider_reference || data.provider_reference || null;
    const rawStatus = inner.status || (data.status === 'success' ? 'pending' : data.status) || 'pending';

    return {
      providerRef,
      externalRef: payload.external_reference,
      status: this.normalizeStatus(rawStatus),
      rawStatus,
      raw: data,
    };
  }

  /**
   * 3. Vérification de transaction — GET /h2h-verify/:reference
   *
   * @param {string} reference - external_reference (REF_...) ou provider_reference (IKP-H2H-...)
   */
  async verifyTransaction(reference) {
    if (!reference) {
      return { valid: false, status: 'pending', message: 'Aucune référence fournie.' };
    }

    try {
      const url = `${this.baseUrl}/h2h-verify/${encodeURIComponent(reference)}`;
      logger.info(`iKeePay H2H Verify -> ${url}`);

      const res = await fetch(url, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: AbortSignal.timeout(12000),
      });

      const body = await res.json().catch(() => ({}));

      if (res.ok) {
        const tx = body?.data && typeof body.data === 'object' ? body.data : body;
        const rawStatus = tx?.status || body?.status || 'pending';
        const normalized = this.normalizeStatus(rawStatus);
        const isApproved = normalized === 'approved';

        return {
          valid: isApproved,
          status: normalized,
          rawStatus,
          providerRef: tx?.provider_reference || null,
          externalRef: tx?.external_reference || reference,
          amount: tx?.amount,
          currency: tx?.currency,
          type: tx?.type,
          operator: tx?.operator,
          data: tx,
          raw: body,
        };
      }

      return {
        valid: false,
        status: 'pending',
        rawStatus: body?.data?.status || body?.status,
        message: body?.message || `HTTP ${res.status}`,
        data: body,
      };
    } catch (err) {
      logger.warn(`iKeePay H2H verifyTransaction error: ${err.message}`);
      return {
        valid: false,
        status: 'pending',
        error: err.message,
      };
    }
  }

  /**
   * 4. Sécurité Webhook — Vérification HMAC SHA-256 (X-Ikeepay-Signature).
   *
   * @param {Buffer|string} rawBody - Corps brut de la requête
   * @param {string} signature - En-tête HTTP X-Ikeepay-Signature
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signature) {
    const key = (this.secretKey || '').trim();
    if (!key) {
      logger.warn('iKeePay webhook received while secretKey is empty — rejecting signature check.');
      return false;
    }
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const payload = Buffer.isBuffer(rawBody) ? rawBody : String(rawBody || '');
    const expectedSignature = crypto
      .createHmac('sha256', key)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(signature.trim(), 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }

  /**
   * Normalize iKeePay H2H status into internal status:
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
