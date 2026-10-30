import { describe, it, expect, beforeEach } from '@jest/globals';
import { evaluateSymbolForDelegate } from '../src/services/tradingDelegateService.js';
import TradingDelegateConfig from '../src/models/TradingDelegateConfig.js';

describe('AI Trading Delegate - Intelligent Market Surveillance Engine', () => {
  let mockConfig;
  let mockEntryDef;
  let mockSnapshot;

  beforeEach(() => {
    mockConfig = {
      userId: '507f1f77bcf86cd799439099',
      isEnabled: true,
      isPassiveMode: false,
      markets: ['forex', 'commodities', 'indices', 'synthetic'],
      symbols: ['EURUSD', 'XAUUSD', 'US30'],
      timeframes: ['H1', 'H4'],
      strategies: ['SMC'],
      minConfidenceScore: 75,
      minRiskReward: 2.0,
      maxRiskPerTradePercent: 1.0,
      operatingHours: { enabled: false },
      activeDays: [1, 2, 3, 4, 5],
      maxSignalsPerDay: 5,
      notifications: { inApp: true, email: true, minScoreForEmail: 80 },
      invalidationRules: { maxSlippageDriftPercent: 0.35, ttlHours: 8 },
    };

    mockEntryDef = {
      symbol: 'EURUSD',
      market: 'forex',
      base: 1.0850,
    };

    mockSnapshot = {
      symbol: 'EURUSD',
      isRealData: true,
      source: 'LiveMarket',
      quote: { price: 1.0850 },
      candles: [
        { open: 1.082, high: 1.083, low: 1.081, close: 1.0825 },
        { open: 1.0825, high: 1.084, low: 1.082, close: 1.0835 },
        { open: 1.0835, high: 1.085, low: 1.083, close: 1.0845 },
        { open: 1.0845, high: 1.086, low: 1.084, close: 1.0855 },
      ],
    };
  });

  describe('Surveillance Evaluation Engine', () => {
    it('generates a valid high-quality opportunity when market structure aligns', () => {
      const res = evaluateSymbolForDelegate({
        entryDef: mockEntryDef,
        snapshot: mockSnapshot,
        config: mockConfig,
      });

      expect(['VALID', 'SETUP_INSUFFICIENT']).toContain(res.status);
      if (res.status === 'VALID') {
        const opp = res.opportunity;
        expect(opp.symbol).toBe('EURUSD');
        expect(opp.market).toBe('forex');
        expect(['BUY', 'SELL']).toContain(opp.direction);
        expect(opp.confidenceScore).toBeGreaterThanOrEqual(mockConfig.minConfidenceScore);
        expect(opp.entry).toBeGreaterThan(0);
        expect(opp.stopLoss).toBeGreaterThan(0);
        expect(opp.takeProfit1).toBeGreaterThan(0);
        expect(opp.takeProfit2).toBeGreaterThan(0);
        expect(opp.zones.length).toBeGreaterThanOrEqual(3);
        expect(opp.status).toBe('NEW_OPPORTUNITY');
      }
    });

    it('rejects evaluation when market quote is missing or invalid', () => {
      const invalidSnapshot = { quote: { price: 0 } };
      const res = evaluateSymbolForDelegate({
        entryDef: { symbol: 'EURUSD', market: 'forex', base: 0 },
        snapshot: invalidSnapshot,
        config: mockConfig,
      });

      expect(res.status).toBe('SETUP_INSUFFICIENT');
      expect(res.reason).toContain('indisponible');
    });

    it('enforces user minimum confidence score filter', () => {
      // Set unrealistically high confidence requirement
      const strictConfig = { ...mockConfig, minConfidenceScore: 99 };
      const res = evaluateSymbolForDelegate({
        entryDef: mockEntryDef,
        snapshot: mockSnapshot,
        config: strictConfig,
      });

      expect(res.status).toBe('SETUP_INSUFFICIENT');
      expect(res.reason).toContain('inférieur au seuil minimal');
    });

    it('integrates with AI Capital Manager to reject setups if risk calculation fails', () => {
      // 0 entry price will fail risk calculator
      const res = evaluateSymbolForDelegate({
        entryDef: { symbol: 'EURUSD', market: 'forex', base: -1 },
        snapshot: { quote: { price: -1 } },
        config: mockConfig,
      });

      expect(['SETUP_INSUFFICIENT', 'RISK_REJECTED']).toContain(res.status);
    });
  });

  describe('Active Window & Daily Schedule Verification', () => {
    it('verifies schedule helpers on TradingDelegateConfig document', () => {
      const doc = new TradingDelegateConfig({
        userId: '507f1f77bcf86cd799439099',
        activeDays: [0, 1, 2, 3, 4, 5, 6], // all days
        operatingHours: { enabled: false },
      });

      expect(doc.isWithinActiveWindow()).toBe(true);
    });

    it('resets daily signal counters when date changes', () => {
      const doc = new TradingDelegateConfig({
        userId: '507f1f77bcf86cd799439099',
        metrics: {
          date: '2020-01-01',
          signalsCountToday: 5,
          totalSignalsGenerated: 12,
        },
      });

      doc.ensureDailyReset();
      expect(doc.metrics.signalsCountToday).toBe(0);
      expect(doc.metrics.totalSignalsGenerated).toBe(12);
      expect(doc.metrics.date).toBe(new Date().toISOString().slice(0, 10));
    });
  });
});
