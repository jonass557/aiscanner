import config from '../../config/index.js';
import logger from '../../config/logger.js';
import { SebPayProvider } from './SebPayProvider.js';
import { DemoPaymentProvider } from './DemoPaymentProvider.js';

/**
 * Payment provider factory. Mirrors the AI/market-data pattern: resolve by
 * name (or config), fall back to demo when not configured.
 */

const getProvider = (providerName = config.payments.provider) => {
  if (providerName === 'sebpay') {
    const provider = new SebPayProvider(config.payments.sebpay);
    if (provider.isConfigured()) return provider;
    logger.warn('SebPay is not configured; falling back to demo payment provider.');
  } else if (providerName !== 'demo') {
    logger.warn(`Unknown payment provider "${providerName}"; using demo.`);
  }
  return new DemoPaymentProvider();
};

export { getProvider, SebPayProvider, DemoPaymentProvider };
export { SEBPAY_SIGNATURE_HEADER } from './SebPayProvider.js';
