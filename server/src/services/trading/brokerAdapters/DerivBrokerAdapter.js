import { BaseBrokerAdapter } from './BaseBrokerAdapter.js';
import logger from '../../../config/logger.js';

const DERIV_WS_ENDPOINT = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

/**
 * Official Deriv WebSocket API Adapter.
 *
 * Implements:
 * - WebSocket connection with timeout protection
 * - Explicit scope check: 'read' vs 'trade' permissions
 * - Account balance, currency, and login details
 * - Safe contract execution & broker-side Stop-Loss verification
 */
export class DerivBrokerAdapter extends BaseBrokerAdapter {
  constructor() {
    super('deriv');
  }

  /**
   * Helper to perform a single request/response round-trip over Deriv WebSocket.
   */
  async _sendDerivRequest(requestPayload, timeoutMs = 12000) {
    if (typeof WebSocket === 'undefined') {
      throw new Error('Native WebSocket is not available in the current Node environment.');
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(DERIV_WS_ENDPOINT);
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        try {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch {}
      };

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Délai d'attente dépassé (timeout ${timeoutMs}ms) lors de la communication avec Deriv.`));
      }, timeoutMs);

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify(requestPayload));
        } catch (err) {
          cleanup();
          reject(new Error(`Échec d'envoi de la requête Deriv: ${err.message}`));
        }
      };

      ws.onmessage = (event) => {
        cleanup();
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            reject(new Error(data.error.message || 'Erreur retournée par l\'API Deriv'));
          } else {
            resolve(data);
          }
        } catch (err) {
          reject(new Error(`Réponse Deriv invalide: ${err.message}`));
        }
      };

      ws.onerror = (err) => {
        cleanup();
        reject(new Error(`Erreur de connexion WebSocket Deriv: ${err.message || 'Connexion impossible'}`));
      };
    });
  }

  /**
   * Authorize token and verify real permission scopes.
   */
  async validatePermissions(account) {
    const token = typeof account.getToken === 'function' ? account.getToken() : account.token;
    if (!token) {
      return {
        success: false,
        canRead: false,
        canTrade: false,
        permissions: [],
        error: 'Jeton API Deriv manquant ou vide.',
      };
    }

    try {
      const response = await this._sendDerivRequest({ authorize: token });
      const auth = response?.authorize;

      if (!auth) {
        return {
          success: false,
          canRead: false,
          canTrade: false,
          permissions: [],
          error: 'Échec d\'autorisation Deriv : réponse vide.',
        };
      }

      // Check permissions: Deriv scopes array (e.g. ['read', 'trade', 'payments', 'admin'])
      const scopes = Array.isArray(auth.scopes) ? auth.scopes : ['read'];
      const canRead = scopes.includes('read');
      const canTrade = scopes.includes('trade');

      return {
        success: true,
        canRead,
        canTrade,
        permissions: scopes,
        accountId: auth.loginid || account.accountId,
        currency: auth.currency || 'USD',
        balance: Number(auth.balance || 0),
        equity: Number(auth.balance || 0), // Base Deriv cash balance
        accountType: auth.is_virtual ? 'demo' : 'real',
        email: auth.email,
      };
    } catch (err) {
      logger.warn(`Deriv validation failed for account ${account.accountId}: ${err.message}`);
      return {
        success: false,
        canRead: false,
        canTrade: false,
        permissions: [],
        error: err.message,
      };
    }
  }

  /**
   * Fetch live account balance.
   */
  async getAccountSnapshot(account) {
    const val = await this.validatePermissions(account);
    if (!val.success) {
      throw new Error(val.error || 'Impossible de récupérer le solde Deriv');
    }
    return {
      balance: val.balance,
      equity: val.equity,
      currency: val.currency,
      accountType: val.accountType,
    };
  }

  /**
   * Execute trade order on Deriv.
   */
  async executeOrder(account, orderRequest) {
    const token = typeof account.getToken === 'function' ? account.getToken() : account.token;
    if (!token) {
      throw new Error('Token Deriv manquant');
    }

    // Permission enforcement: Never attempt trade if token only has read rights
    if (!account.isTradeAuthorized) {
      throw new Error(
        'Le compte Deriv connecté ne possède que les droits en LECTURE SEULE. Pour autoriser le passage d\'ordres, veuillez reconnecter un jeton avec le scope "trade".'
      );
    }

    // Map internal canonical symbol to Deriv symbol if needed
    // e.g. "Volatility 75 Index" -> "R_75", "Boom 1000 Index" -> "BOOM1000"
    const DERIV_SYMBOL_MAP = {
      'Volatility 75 Index': 'R_75',
      'Volatility 100 Index': 'R_100',
      'Volatility 50 Index': 'R_50',
      'Volatility 25 Index': 'R_25',
      'Volatility 10 Index': 'R_10',
      'Boom 1000 Index': 'BOOM1000',
      'Crash 1000 Index': 'CRASH1000',
      'Boom 500 Index': 'BOOM500',
      'Crash 500 Index': 'CRASH500',
      'Boom 300 Index': 'BOOM300',
      'Crash 300 Index': 'CRASH300',
      'Step Index': 'STP_1',
    };

    const derivSymbol = DERIV_SYMBOL_MAP[orderRequest.symbol] || orderRequest.symbol;

    try {
      // 1. Authorize connection
      const authRes = await this._sendDerivRequest({ authorize: token });
      if (!authRes?.authorize?.scopes?.includes('trade')) {
        throw new Error('Le token Deriv actif n\'a pas la permission d\'exécution (trade scope manquant).');
      }

      // 2. Multiplier / CFD Contract Buy with broker-side Stop-Loss & Take-Profit
      const buyRequest = {
        buy: 1,
        price: orderRequest.volume,
        parameters: {
          amount: orderRequest.volume,
          basis: 'stake',
          contract_type: orderRequest.direction === 'BUY' ? 'MULTUP' : 'MULTDOWN',
          currency: account.currency || 'USD',
          symbol: derivSymbol,
          stop_loss: orderRequest.stopLoss ? Math.abs(orderRequest.requestedPrice - orderRequest.stopLoss) : undefined,
          take_profit: orderRequest.takeProfit ? Math.abs(orderRequest.takeProfit - orderRequest.requestedPrice) : undefined,
        },
      };

      const buyRes = await this._sendDerivRequest({
        ...buyRequest,
        passthrough: { idempotencyKey: orderRequest.idempotencyKey },
      });

      const receipt = buyRes?.buy;
      if (!receipt || !receipt.contract_id) {
        throw new Error('Réponse d\'achat Deriv incomplète');
      }

      const executionPrice = Number(receipt.ask_price || orderRequest.requestedPrice);
      const slippage = Number((executionPrice - orderRequest.requestedPrice).toFixed(4));

      return {
        success: true,
        brokerOrderId: String(receipt.transaction_id || receipt.contract_id),
        brokerPositionId: String(receipt.contract_id),
        executionPrice,
        status: 'FILLED',
        slippage,
        fees: 0,
        rawResponse: receipt,
      };
    } catch (err) {
      logger.error(`Deriv execution failed for ${orderRequest.symbol}: ${err.message}`);
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
