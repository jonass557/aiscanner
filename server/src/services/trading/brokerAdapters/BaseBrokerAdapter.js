/**
 * Abstract Base Broker Adapter.
 * All broker implementations (Deriv, Binance, Paper, MT5) inherit from this interface.
 */
export class BaseBrokerAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * Validate token and check real permissions.
   * Must distinguish 'read' from 'trade' permissions.
   *
   * @param {Object} account - BrokerAccount document
   * @returns {Promise<{ success: boolean, canRead: boolean, canTrade: boolean, accountId: string, currency: string, balance: number, equity: number, permissions: string[], error?: string }>}
   */
  async validatePermissions(account) {
    throw new Error(`validatePermissions() not implemented for ${this.name}`);
  }

  /**
   * Fetch current account snapshot (balance, equity, margin).
   * @param {Object} account
   * @returns {Promise<{ balance: number, equity: number, currency: string, freeMargin?: number }>}
   */
  async getAccountSnapshot(account) {
    throw new Error(`getAccountSnapshot() not implemented for ${this.name}`);
  }

  /**
   * Fetch all currently open positions from the broker.
   * @param {Object} account
   * @returns {Promise<Array<{ brokerPositionId: string, symbol: string, direction: string, volume: number, entryPrice: number, currentPrice: number, pnl: number, stopLoss?: number, takeProfit?: number }>>}
   */
  async getOpenPositions(account) {
    return [];
  }

  /**
   * Execute an order with the broker.
   * @param {Object} account
   * @param {Object} orderRequest - { symbol, market, direction, volume, orderType, requestedPrice, stopLoss, takeProfit, idempotencyKey }
   * @returns {Promise<{ success: boolean, brokerOrderId: string, brokerPositionId?: string, executionPrice: number, status: string, slippage: number, fees: number, rawResponse?: any, error?: string }>}
   */
  async executeOrder(account, orderRequest) {
    throw new Error(`executeOrder() not implemented for ${this.name}`);
  }

  /**
   * Close an open position with the broker.
   * @param {Object} account
   * @param {string} brokerPositionId
   * @returns {Promise<{ success: boolean, closedPrice: number, pnl: number, error?: string }>}
   */
  async closePosition(account, brokerPositionId) {
    throw new Error(`closePosition() not implemented for ${this.name}`);
  }

  /**
   * Cancel a pending order.
   * @param {Object} account
   * @param {string} brokerOrderId
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async cancelOrder(account, brokerOrderId) {
    throw new Error(`cancelOrder() not implemented for ${this.name}`);
  }

  /**
   * Whether this broker supports native broker-side Stop-Loss & Take-Profit orders for this symbol.
   * @param {string} symbol
   * @returns {boolean}
   */
  supportsBrokerSideSlTp(symbol) {
    return true;
  }
}
