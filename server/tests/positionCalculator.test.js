import { describe, it, expect } from '@jest/globals';
import {
  calculatePositionSize,
  floorToStep,
  getDecimals,
} from '../src/services/financial/positionCalculator.js';
import { getInstrumentSpec } from '../src/services/financial/instrumentSpecs.js';
import { getConversionRate } from '../src/services/financial/currencyConverter.js';

describe('AI Position Size Calculator - Financial Engine', () => {
  describe('Utilities: getDecimals & floorToStep', () => {
    it('correctly calculates decimal places', () => {
      expect(getDecimals(1)).toBe(0);
      expect(getDecimals(0.1)).toBe(1);
      expect(getDecimals(0.01)).toBe(2);
      expect(getDecimals(0.001)).toBe(3);
    });

    it('strictly floors values to broker step without rounding up', () => {
      expect(floorToStep(0.019, 0.01)).toBe(0.01);
      expect(floorToStep(0.011, 0.01)).toBe(0.01);
      expect(floorToStep(0.020, 0.01)).toBe(0.02);
      expect(floorToStep(0.158, 0.05)).toBe(0.15);
      expect(floorToStep(0.0029, 0.001)).toBe(0.002);
    });
  });

  describe('Forex Calculations', () => {
    it('calculates standard EUR/USD position on USD account', () => {
      // Capital: $10,000, 1% risk = $100
      // Entry: 1.0850, SL: 1.0800 (50 pips)
      // Pip value for 1.0 lot EURUSD = $10
      // 50 pips * $10 = $500 loss per lot (+ $7 commission = $507)
      // Raw volume = 100 / 507 = ~0.1972 lots -> floored to 0.19 lots
      const res = calculatePositionSize({
        capital: 10000,
        accountCurrency: 'USD',
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0850,
        stopLossPrice: 1.0800,
        takeProfitPrice: 1.1000, // 150 pips -> 1:3 RR
        riskType: 'percent',
        riskValue: 1.0,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('COMPLIANT');
      expect(res.complianceTone).toBe('success');
      expect(res.slPips).toBe(50);
      expect(res.executableVolume).toBe(0.19);
      expect(res.actualLossAtSL).toBeLessThanOrEqual(100);
      expect(res.riskRewardRatio).toBe(3);
      expect(res.actualGainAtTP).toBeGreaterThan(250);
    });

    it('handles USD/JPY with 0.01 pip size', () => {
      // Entry: 155.00, SL: 154.00 (100 pips)
      const res = calculatePositionSize({
        capital: 5000,
        accountCurrency: 'USD',
        symbol: 'USDJPY',
        direction: 'BUY',
        entryPrice: 155.00,
        stopLossPrice: 154.00,
        riskType: 'amount',
        riskValue: 50,
      });

      expect(res.success).toBe(true);
      expect(res.slPips).toBe(100);
      expect(res.executableVolume).toBeGreaterThan(0);
      expect(res.actualLossAtSL).toBeLessThanOrEqual(50);
    });

    it('converts quote currency when trading cross pair EUR/GBP with USD account', () => {
      const res = calculatePositionSize({
        capital: 10000,
        accountCurrency: 'USD',
        symbol: 'EURGBP',
        direction: 'BUY',
        entryPrice: 0.8550,
        stopLossPrice: 0.8500, // 50 pips
        riskType: 'percent',
        riskValue: 1.0,
      });

      expect(res.success).toBe(true);
      expect(res.slPips).toBe(50);
      // Quote is GBP, converted to USD (> $10 per pip)
      expect(res.accountPipValuePerLot).toBeGreaterThan(12);
      expect(res.executableVolume).toBeGreaterThan(0);
      expect(res.actualLossAtSL).toBeLessThanOrEqual(100);
    });
  });

  describe('Metals & Commodities (Gold & Oil)', () => {
    it('calculates Gold (XAU/USD) position with 100 oz contract size', () => {
      // Entry: 2700, SL: 2690 ($10 distance)
      // 1 lot = 100 oz -> $10 move * 100 = $1,000 loss per lot (+ $5 comm = $1005)
      // Risk $200 -> volume = 200 / 1005 = ~0.199 -> floored to 0.19
      const res = calculatePositionSize({
        capital: 20000,
        accountCurrency: 'USD',
        symbol: 'XAUUSD',
        direction: 'BUY',
        entryPrice: 2700.0,
        stopLossPrice: 2690.0,
        takeProfitPrice: 2725.0,
        riskType: 'amount',
        riskValue: 200,
      });

      expect(res.success).toBe(true);
      expect(res.executableVolume).toBe(0.19);
      expect(res.actualLossAtSL).toBeLessThanOrEqual(200);
      expect(res.riskRewardRatio).toBe(2.5);
    });
  });

  describe('Crypto & Indices', () => {
    it('calculates Bitcoin (BTC/USD) position', () => {
      // Entry: 68,000, SL: 66,000 ($2,000 distance)
      // Risk $100 -> 100 / 2000 = 0.05 BTC
      const res = calculatePositionSize({
        capital: 10000,
        accountCurrency: 'USD',
        symbol: 'BTCUSD',
        direction: 'BUY',
        entryPrice: 68000,
        stopLossPrice: 66000,
        riskType: 'amount',
        riskValue: 100,
      });

      expect(res.success).toBe(true);
      expect(res.executableVolume).toBe(0.05);
      expect(res.actualLossAtSL).toBe(100);
    });

    it('calculates US30 index position', () => {
      // Entry: 43000, SL: 42900 (100 points)
      // Risk $50 -> 50 / 100 = 0.50 lots
      const res = calculatePositionSize({
        capital: 5000,
        accountCurrency: 'USD',
        symbol: 'US30',
        direction: 'BUY',
        entryPrice: 43000,
        stopLossPrice: 42900,
        riskType: 'amount',
        riskValue: 50,
      });

      expect(res.success).toBe(true);
      expect(res.executableVolume).toBe(0.5);
      expect(res.actualLossAtSL).toBe(50);
    });
  });

  describe('Deriv Synthetic Indices & Min Lot Risk Enforcement', () => {
    it('calculates Volatility 75 Index with 0.001 min lot', () => {
      // Entry: 325,000, SL: 323,000 (2,000 points)
      // 1 lot loses $2000 -> 0.001 lot loses $2
      // Risk $10 -> volume = 10 / 2000 = 0.005 lots
      const res = calculatePositionSize({
        capital: 1000,
        accountCurrency: 'USD',
        symbol: 'Volatility 75 Index',
        direction: 'BUY',
        entryPrice: 325000,
        stopLossPrice: 323000,
        riskType: 'amount',
        riskValue: 10,
      });

      expect(res.success).toBe(true);
      expect(res.executableVolume).toBe(0.005);
      expect(res.actualLossAtSL).toBe(10);
      expect(res.status).toBe('COMPLIANT');
    });

    it('triggers RISQUE TROP ÉLEVÉ POUR LE VOLUME MINIMAL on Boom 1000 when capital/risk is too small', () => {
      // Boom 1000 min lot is 0.20
      // Entry: 12500, SL: 12400 (100 points)
      // At min lot of 0.20: loss = 100 * $1 * 0.20 = $20.00
      // User has $100 account and wants to risk only 1% ($1.00)
      const res = calculatePositionSize({
        capital: 100,
        accountCurrency: 'USD',
        symbol: 'Boom 1000 Index',
        direction: 'BUY',
        entryPrice: 12500,
        stopLossPrice: 12400,
        riskType: 'percent',
        riskValue: 1.0, // $1.00
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('REJECTED_MIN_LOT_RISK_EXCEEDED');
      expect(res.complianceTone).toBe('danger');
      expect(res.isRiskTooHighForMinLot).toBe(true);
      expect(res.complianceMessage).toBe('RISQUE TROP ÉLEVÉ POUR LE VOLUME MINIMAL');
      expect(res.executableVolume).toBe(0);
      expect(res.lossAtMinLot).toBe(20);
      expect(res.targetRiskAmount).toBe(1);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('rejects invalid directions and inverted stop loss', () => {
      // BUY with SL above entry
      const buyInvalid = calculatePositionSize({
        capital: 10000,
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0800,
        stopLossPrice: 1.0850,
      });
      expect(buyInvalid.success).toBe(false);
      expect(buyInvalid.errors.some((e) => e.includes('strictement inférieur'))).toBe(true);

      // SELL with SL below entry
      const sellInvalid = calculatePositionSize({
        capital: 10000,
        symbol: 'EURUSD',
        direction: 'SELL',
        entryPrice: 1.0850,
        stopLossPrice: 1.0800,
      });
      expect(sellInvalid.success).toBe(false);
      expect(sellInvalid.errors.some((e) => e.includes('strictement supérieur'))).toBe(true);
    });

    it('rejects zero or negative capital', () => {
      const res = calculatePositionSize({
        capital: 0,
        symbol: 'EURUSD',
        direction: 'BUY',
        entryPrice: 1.0850,
        stopLossPrice: 1.0800,
      });
      expect(res.success).toBe(false);
      expect(res.errors.some((e) => e.includes('capital'))).toBe(true);
    });

    it('flags MARGE INSUFFISANTE when leverage is too low for the required margin', () => {
      // Entry $68,000 for BTC, capital $500, leverage 1:1
      const res = calculatePositionSize({
        capital: 500,
        accountCurrency: 'USD',
        symbol: 'BTCUSD',
        direction: 'BUY',
        entryPrice: 68000,
        stopLossPrice: 67500, // $500 distance
        riskType: 'amount',
        riskValue: 300,
        leverage: 1, // no leverage -> 0.6 BTC costs $40,800
      });

      expect(res.success).toBe(true);
      expect(res.insufficientMargin).toBe(true);
      expect(res.status).toBe('REJECTED_INSUFFICIENT_MARGIN');
      expect(res.complianceTone).toBe('danger');
    });
  });
});
