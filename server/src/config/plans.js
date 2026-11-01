/**
 * Subscription plan definitions — the single source of truth for pricing,
 * scan limits, and feature lists. Used by the subscription logic, the admin
 * panel, and the pricing section of the landing page (via the API).
 *
 * scansPerMonth: -1 means unlimited.
 */
export const PLANS = {
  '1mois': {
    id: '1mois',
    name: 'Plan 1 Mois',
    price: 7000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: true, days: 7 },
    features: [
      'Essai gratuit sans engagement',
      'Scans de graphiques 100% illimités',
      'Robot de Trading Haute Probabilité',
      'AI Scanner & Chart Vision',
      'IA Trading Delegate & Surveillance live',
      'IA Mentor bilingue FR/EN',
      'Support prioritaire WhatsApp',
    ],
  },
  '2mois': {
    id: '2mois',
    name: 'Plan 2 Mois',
    price: 13000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: false, days: 0 },
    features: [
      'Tarif préférentiel 2 mois',
      'Scans de graphiques 100% illimités',
      'Robot de Trading Haute Probabilité',
      'AI Scanner & Chart Vision',
      'IA Managed Trading & Détection institutionnelle',
      'Backtesting Studio & Replay illimité',
      'Support prioritaire WhatsApp 24/7',
    ],
  },
  '6mois': {
    id: '6mois',
    name: 'Plan 6 Mois',
    price: 35000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: false, days: 0 },
    features: [
      'Offre Semestrielle VIP (-30% de réduction)',
      'Scans de graphiques 100% illimités',
      'Accès complet à tous les 11 outils IA',
      'Signaux institutionnels en direct 24/7',
      'Stratégies sur mesure & direct robot execution',
      'Audit personnalisé des positions',
      'Ligne directe WhatsApp VIP',
    ],
  },
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'XOF',
    scansPerMonth: -1,
    features: ['Scans illimités', 'Analyses de base', 'Accès standard'],
  },
  pro: {
    id: 'pro',
    name: 'Plan 1 Mois (Pro)',
    price: 7000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: true, days: 7 },
    features: ['Essai gratuit inclus', 'Scans illimités', 'Outils IA complets'],
  },
  premium: {
    id: 'premium',
    name: 'Plan 6 Mois (VIP)',
    price: 35000,
    currency: 'XOF',
    scansPerMonth: -1,
    features: ['Accès VIP illimité', 'Tous les outils IA', 'Support VIP'],
  },
};

export const getPlan = (planId) => PLANS[planId] || PLANS.free;

export const PLAN_IDS = Object.keys(PLANS);
