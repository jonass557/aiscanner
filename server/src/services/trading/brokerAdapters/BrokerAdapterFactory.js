import { DerivBrokerAdapter } from './DerivBrokerAdapter.js';
import { BinanceBrokerAdapter } from './BinanceBrokerAdapter.js';
import { PaperTradingBrokerAdapter } from './PaperTradingBrokerAdapter.js';

const deriv = new DerivBrokerAdapter();
const binance = new BinanceBrokerAdapter();
const paper = new PaperTradingBrokerAdapter();

/**
 * Factory to retrieve the proper broker adapter instance.
 * @param {string} brokerName - 'deriv' | 'binance' | 'paper' | 'metaapi_mt5'
 * @returns {BaseBrokerAdapter}
 */
export const getBrokerAdapter = (brokerName) => {
  const norm = String(brokerName || '').toLowerCase().trim();
  switch (norm) {
    case 'deriv':
      return deriv;
    case 'binance':
      return binance;
    case 'paper':
    case 'simulation':
      return paper;
    case 'metaapi_mt5':
    case 'mt5':
    case 'mt4':
      // Return a descriptive placeholder that explains native MT4/MT5 limitations
      return {
        name: 'metaapi_mt5',
        validatePermissions: async () => ({
          success: false,
          canRead: false,
          canTrade: false,
          permissions: [],
          error:
            'L\'intégration directe MetaTrader MT4/MT5 nécessite une passerelle dédiée (MetaApi / EA ZeroMQ Bridge) actuellement non connectée. Utilisez le mode Simulation ou Deriv.',
        }),
        executeOrder: async () => {
          throw new Error(
            'L\'exécution directe MT4/MT5 nécessite un bridge serveur. Cette intégration n\'est pas active.'
          );
        },
        supportsBrokerSideSlTp: () => true,
      };
    default:
      throw new Error(`Courtier / Broker inconnu ou non supporté : ${brokerName}`);
  }
};
