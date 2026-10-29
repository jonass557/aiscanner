import { describe, it, expect, beforeEach } from '@jest/globals';
import { validateOrderPreFlight } from '../src/services/trading/orderValidationEngine.js';
import { PaperTradingBrokerAdapter } from '../src/services/trading/brokerAdapters/PaperTradingBrokerAdapter.js';
import { DerivBrokerAdapter } from '../src/services/trading/brokerAdapters/DerivBrokerAdapter.js';
import { getBrokerAdapter } from '../src/services/trading/brokerAdapters/BrokerAdapterFactory.js';

describe('AI Managed Trading - Risk & Execution Engine', () => {
  let mockUser;
  let mockAccount;
  let mockConfig;
  let mockOpportunity;
  let mockQuote;

  beforeEach(() => {
    mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Trader Pro',
    };

    mockAccount = {
      _id: '507f1f77bcf86cd799439022',
      broker: 'paper',
      accountId: 'PAPER-123456',
      accountType: 'paper',
      currency: 'USD',
      balance: 10000,
      equity: 10000,
      connectionStatus: 'connected',
      isTradeAuthorized: true,
      permissions: ['read', 'trade'],
    };

    mockConfig = {
      operatingMode: 'automated',
      isEmergencyStopped: false,
      emergencyStopReason: '',
      maxRiskPerTradePercent: 1.0, // 1%
      maxRiskPerTradeAmount: 100, // $100
      maxDailyLossPercent: 3.0,
      maxDailyLossAmount: 300,
      maxDrawdownPercent: 6.0,
      maxOpenPositions: 2,
      maxOrdersPerDay: 5,
      maxAllowedSlippagePercent: 0.20,
      allowedMarkets: ['forex', 'crypto', 'indices', 'commodities', 'synthetic'],
      allowedSymbols: [],
      explicitAuthorization: {
        confirmed: true,
        confirmedAt: new Date(),
        acknowledgedRisks: true,
      },
      dailyMetrics: {
        date: new Date().toISOString().slice(0, 10),
        realizedLossToday: 0,
        realizedProfitToday: 0,
        ordersExecutedToday: 0,
        peakEquity: 10000,
      },
      isWithinTradingHours: () => true,
      ensureDailyMetricsReset: () => {},
    };

    mockOpportunity = {
      _id: '507f1f77bcf86cd799439033',
      symbol: 'EURUSD',
      market: 'forex',
      direction: 'BUY',
      entry: 1.0850,
      stopLoss: 1.0800, // 50 pips
      takeProfit1: 1.1000, // 150 pips -> 1:3 RR
      status: 'active',
      confidenceScore: 85,
    };

    mockQuote = {
      symbol: 'EURUSD',
      price: 1.0850,
      timestamp: Date.now(),
    };
  });

  describe('13-Point Pre-Order Validation Engine', () => {
    it('passes all 13 checks when trade and risk are completely compliant', async () => {
      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: mockAccount,
        opportunity: mockOpportunity,
        liveQuote: mockQuote,
        executionMode: 'automated',
        idempotencyKey: 'test-key-compliant-1',
      });

      expect(res.pass).toBe(true);
      expect(res.checklist.userAuth).toBe(true);
      expect(res.checklist.modeActive).toBe(true);
      expect(res.checklist.connectionValid).toBe(true);
      expect(res.checklist.freshData).toBe(true);
      expect(res.checklist.notExpired).toBe(true);
      expect(res.checklist.symbolAllowed).toBe(true);
      expect(res.checklist.riskWithinLimit).toBe(true);
      expect(res.checklist.sizeCorrect).toBe(true);
      expect(res.checklist.slTpValid).toBe(true);
      expect(res.checklist.dailyLimitsOk).toBe(true);
      expect(res.checklist.slippageOk).toBe(true);
      expect(res.checklist.brokerConstraintsOk).toBe(true);
      expect(res.sizing.executableVolume).toBeGreaterThan(0);
    });

    it('rejects order immediately if Emergency Kill Switch is active', async () => {
      mockConfig.isEmergencyStopped = true;
      mockConfig.emergencyStopReason = 'Arrêt manuel de secours';

      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: mockAccount,
        opportunity: mockOpportunity,
        liveQuote: mockQuote,
        executionMode: 'automated',
        idempotencyKey: 'test-key-emergency',
      });

      expect(res.pass).toBe(false);
      expect(res.checklist.modeActive).toBe(false);
      expect(res.rejectionReason).toContain('Arrêt d\'urgence');
    });

    it('rejects order if automated mode is inactive in config', async () => {
      mockConfig.operatingMode = 'analysis_only';

      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: mockAccount,
        opportunity: mockOpportunity,
        liveQuote: mockQuote,
        executionMode: 'automated',
        idempotencyKey: 'test-key-mode-off',
      });

      expect(res.pass).toBe(false);
      expect(res.checklist.modeActive).toBe(false);
      expect(res.rejectionReason).toContain('désactivé');
    });

    it('rejects trade if broker token has only read-only permissions', async () => {
      const readOnlyAccount = {
        ...mockAccount,
        accountType: 'real',
        broker: 'deriv',
        isTradeAuthorized: false,
        permissions: ['read'],
      };

      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: readOnlyAccount,
        opportunity: mockOpportunity,
        liveQuote: mockQuote,
        executionMode: 'automated',
        idempotencyKey: 'test-key-readonly',
      });

      expect(res.pass).toBe(false);
      expect(res.checklist.connectionValid).toBe(false);
      expect(res.rejectionReason).toContain('permission "trade" manquante');
    });

    it('rejects order if market price has drifted beyond maximum allowed slippage', async () => {
      // Signal entry was 1.0850, current live price is 1.0900 (0.46% drift > 0.20% max allowed)
      const driftedQuote = {
        symbol: 'EURUSD',
        price: 1.0900,
        timestamp: Date.now(),
      };

      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: mockAccount,
        opportunity: mockOpportunity,
        liveQuote: driftedQuote,
        executionMode: 'automated',
        idempotencyKey: 'test-key-drift',
      });

      expect(res.pass).toBe(false);
      expect(res.checklist.slippageOk).toBe(false);
      expect(res.rejectionReason).toContain('trop dérivé du prix du signal');
    });

    it('rejects order if market data quote is stale (> 5 minutes)', async () => {
      const staleQuote = {
        symbol: 'EURUSD',
        price: 1.0850,
        timestamp: Date.now() - 6 * 60 * 1000, // 6 mins ago
      };

      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: mockAccount,
        opportunity: mockOpportunity,
        liveQuote: staleQuote,
        executionMode: 'automated',
        idempotencyKey: 'test-key-stale',
      });

      expect(res.pass).toBe(false);
      expect(res.checklist.freshData).toBe(false);
      expect(res.rejectionReason).toContain('périmées');
    });

    it('rejects order if daily loss limit would be breached', async () => {
      // Daily loss limit is $300. Realized loss is already $280.
      mockConfig.dailyMetrics.realizedLossToday = 280;
      // Trade risk on $10,000 at 1% is $100 -> 280 + 100 = 380 > 300!
      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: mockAccount,
        opportunity: mockOpportunity,
        liveQuote: mockQuote,
        executionMode: 'automated',
        idempotencyKey: 'test-key-daily-loss',
      });

      expect(res.pass).toBe(false);
      expect(res.checklist.dailyLimitsOk).toBe(false);
      expect(res.rejectionReason).toContain('Limite de perte quotidienne');
    });

    it('rejects order if broker minimum lot produces a risk higher than accepted (RISQUE TROP ÉLEVÉ)', async () => {
      // Boom 1000 min lot is 0.20. Account equity is only $50. Target risk 1% = $0.50.
      const boomOpportunity = {
        symbol: 'Boom 1000 Index',
        market: 'synthetic',
        direction: 'BUY',
        entry: 12500,
        stopLoss: 12400, // 100 points
        status: 'active',
      };
      const smallAccount = {
        ...mockAccount,
        equity: 50,
        balance: 50,
      };

      const res = await validateOrderPreFlight({
        user: mockUser,
        config: mockConfig,
        account: smallAccount,
        opportunity: boomOpportunity,
        liveQuote: { symbol: 'Boom 1000 Index', price: 12500, timestamp: Date.now() },
        executionMode: 'automated',
        idempotencyKey: 'test-key-boom-overflow',
      });

      expect(res.pass).toBe(false);
      expect(res.checklist.sizeCorrect).toBe(false);
      expect(res.rejectionReason).toContain('RISQUE TROP ÉLEVÉ POUR LE VOLUME MINIMAL');
    });
  });

  describe('Broker Adapters & Simulation Engine', () => {
    it('executes simulation order cleanly via PaperTradingBrokerAdapter', async () => {
      const adapter = new PaperTradingBrokerAdapter();
      const res = await adapter.executeOrder(mockAccount, {
        symbol: 'EURUSD',
        direction: 'BUY',
        volume: 0.2,
        requestedPrice: 1.0850,
        stopLoss: 1.0800,
        takeProfit: 1.1000,
        idempotencyKey: 'sim-key-1',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('FILLED');
      expect(res.brokerOrderId).toContain('SIM-');
      expect(res.executionPrice).toBeGreaterThan(0);
      expect(res.rawResponse.isPaperTrading).toBe(true);
    });

    it('verifies that MetaTrader MT4/MT5 adapter explicitly explains gateway limitations', async () => {
      const adapter = getBrokerAdapter('metaapi_mt5');
      const val = await adapter.validatePermissions(mockAccount);
      expect(val.success).toBe(false);
      expect(val.canTrade).toBe(false);
      expect(val.error).toContain('MetaTrader MT4/MT5 nécessite une passerelle dédiée');
    });

    it('refuses trade execution on Deriv adapter when token lacks trade permission', async () => {
      const adapter = new DerivBrokerAdapter();
      const readOnlyDerivAccount = {
        accountId: 'CR999999',
        isTradeAuthorized: false,
        getToken: () => 'read-only-token',
      };

      await expect(
        adapter.executeOrder(readOnlyDerivAccount, {
          symbol: 'Volatility 75 Index',
          direction: 'BUY',
          volume: 0.001,
          requestedPrice: 325000,
          idempotencyKey: 'deriv-key-fail',
        })
      ).rejects.toThrow('LECTURE SEULE');
    });
  });
});
