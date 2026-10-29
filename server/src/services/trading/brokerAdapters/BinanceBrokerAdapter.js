import crypto from 'crypto';
import { BaseBrokerAdapter } from './BaseBrokerAdapter.js';
import logger from '../../../config/logger.js';

const BINANCE_BASE_URL = 'https://api.binance.com';

/**
 * Official Binance Broker Adapter.
 * Signs requests via HMAC SHA-256 and handles permission checks.
 */
export class BinanceBrokerAdapter extends BaseBrokerAdapter {
  constructor() {
    super('binance');
  }

  _signQuery(queryObj, secret) {
    const timestamp = Date.now();
    const query = new URLSearchParams({ ...queryObj, timestamp: String(timestamp) }).toString();
    const signature = crypto.createHmac('sha256', secret).update(query).digest('hex');
    return `${query}&signature=${signature}`;
  }

  async validatePermissions(account) {
    const apiKey = typeof account.getToken === 'function' ? account.getToken() : account.token;
    const apiSecret = typeof account.getSecret === 'function' ? account.getSecret() : account.secret;

    if (!apiKey || !apiSecret) {
      return {
        success: false,
        canRead: false,
        canTrade: false,
        permissions: [],
        error: 'Clé API ou Secret Binance manquant.',
      };
    }

    try {
      const signedQuery = this._signQuery({}, apiSecret);
      const res = await fetch(`${BINANCE_BASE_URL}/api/v3/account?${signedQuery}`, {
        headers: { 'X-MBX-APIKEY': apiKey },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          canRead: false,
          canTrade: false,
          permissions: [],
          error: errJson.msg || `Erreur Binance HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const canTrade = Boolean(data.canTrade);
      const canWithdraw = Boolean(data.canWithdraw);
      const permissions = ['read'];
      if (canTrade) permissions.push('trade');
      if (canWithdraw) permissions.push('payments');

      // Compute total USDT balance
      const usdtBalance = data.balances?.find((b) => b.asset === 'USDT');
      const balance = Number(usdtBalance?.free || 0) + Number(usdtBalance?.locked || 0);

      return {
        success: true,
        canRead: true,
        canTrade,
        permissions,
        accountId: data.uid ? String(data.uid) : account.accountId,
        currency: 'USDT',
        balance,
        equity: balance,
        accountType: 'real',
      };
    } catch (err) {
      logger.warn(`Binance permission check failed: ${err.message}`);
      return {
        success: false,
        canRead: false,
        canTrade: false,
        permissions: [],
        error: err.message,
      };
    }
  }

  async getAccountSnapshot(account) {
    const val = await this.validatePermissions(account);
    if (!val.success) {
      throw new Error(val.error || 'Impossible de récupérer le solde Binance');
    }
    return {
      balance: val.balance,
      equity: val.equity,
      currency: val.currency,
    };
  }

  async executeOrder(account, orderRequest) {
    const apiKey = typeof account.getToken === 'function' ? account.getToken() : account.token;
    const apiSecret = typeof account.getSecret === 'function' ? account.getSecret() : account.secret;

    if (!apiKey || !apiSecret) {
      throw new Error('Identifiants API Binance incomplets.');
    }
    if (!account.isTradeAuthorized) {
      throw new Error('La clé API Binance connectée ne possède pas la permission de trading (canTrade = false).');
    }

    const symbol = orderRequest.symbol.replace(/[^A-Z0-9]/g, '');

    const params = {
      symbol,
      side: orderRequest.direction,
      type: 'MARKET',
      quantity: orderRequest.volume,
      newClientOrderId: orderRequest.idempotencyKey.slice(0, 32),
    };

    try {
      const signed = this._signQuery(params, apiSecret);
      const res = await fetch(`${BINANCE_BASE_URL}/api/v3/order?${signed}`, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': apiKey },
      });

      const data = await res.json();
      if (!res.ok || data.code) {
        throw new Error(data.msg || `Erreur d'ordre Binance ${data.code}`);
      }

      const executionPrice = Number(data.cummulativeQuoteQty) / Number(data.executedQty) || orderRequest.requestedPrice;
      const slippage = Number((executionPrice - orderRequest.requestedPrice).toFixed(4));

      return {
        success: true,
        brokerOrderId: String(data.orderId),
        brokerPositionId: String(data.clientOrderId),
        executionPrice,
        status: 'FILLED',
        slippage,
        fees: 0,
        rawResponse: data,
      };
    } catch (err) {
      logger.error(`Binance order failed: ${err.message}`);
      return {
        success: false,
        brokerOrderId: null,
        executionPrice: null,
        status: 'REJECTED',
        slippage: 0,
        fees: 0,
        error: err.message,
      };
    }
  }

  supportsBrokerSideSlTp(symbol) {
    return true;
  }
}
