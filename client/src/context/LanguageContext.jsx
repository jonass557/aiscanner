import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Système complet de localisation / internationalisation (Français / Anglais).
 * Permet à l'utilisateur de basculer toute la plateforme en Anglais ou en Français
 * sans aucun mot résiduel dans l'autre langue.
 */

const translations = {
  fr: {
    // Navigation
    overview: 'Vue d\'ensemble',
    aiAssistant: 'Assistant IA',
    aiScanner: 'AI Scanner',
    multiTimeframe: 'Multi-Timeframe',
    opportunities: 'Opportunités',
    aiMentor: 'Mentor IA',
    tradeValidator: 'Validateur de Trade',
    tradingJournal: 'Journal de Trading',
    backtesting: 'Backtesting Replay',
    economicNews: 'Actualités Économiques',
    voiceAssistant: 'Assistant Vocal',
    history: 'Historique',
    subscription: 'Abonnement',
    profile: 'Profil',
    settings: 'Paramètres',
    logout: 'Déconnexion',

    // Global UI
    refresh: 'Rafraîchir',
    scanNow: 'Scanner Maintenant',
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    submit: 'Soumettre',
    close: 'Fermer',
    filter: 'Filtrer',
    all: 'Tous',
    loading: 'Chargement…',
    search: 'Rechercher',
    confidence: 'Probabilité',
    entry: 'Entrée',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    rationale: 'Analyse & Rationale',
    confluences: 'Confluences',
    strategy: 'Stratégie',
    riskReward: 'Ratio Risque/Rendement',

    // Journal
    journalTitle: 'Journal de Trading Institutionnel',
    journalSubtitle: 'Enregistrez, analysez et mesurez chaque trade avec discipline et rigueur statistique.',
    newTrade: 'Nouveau Trade',
    totalTrades: 'Total Trades',
    winrate: 'Taux de Victoire',
    netPnl: 'PnL Net',
    openTrades: 'En Cours',
    symbol: 'Actif / Paire',
    direction: 'Direction',
    lotSize: 'Taille (Lots)',
    pnl: 'Gain / Perte ($)',
    status: 'Statut',
    emotions: 'Psychologie / Émotion',
    notes: 'Notes & Analyse',
    lessons: 'Leçons Apprises',
    noTradesYet: 'Aucun trade enregistré pour l\'instant. Cliquez sur Nouveau Trade pour démarrer.',

    // Backtesting
    backtestTitle: 'Station de Backtesting & Replay de Marché',
    backtestSubtitle: 'Entraînez-vous dans les conditions réelles avec replay barre par barre, coupe temporelle et simulation d\'ordres.',
    play: 'Replay',
    pause: 'Pause',
    stepForward: 'Barre Suivante',
    reset: 'Réinitialiser',
    cutBar: 'Couper (Point de départ)',
    speed: 'Vitesse',
    simulateBuy: 'Simuler Achat (BUY)',
    simulateSell: 'Simuler Vente (SELL)',
    closePosition: 'Clôturer Position',

    // Languages
    language: 'Langue',
    french: 'Français',
    english: 'English',
  },

  en: {
    // Navigation
    overview: 'Overview',
    aiAssistant: 'AI Assistant',
    aiScanner: 'AI Scanner',
    multiTimeframe: 'Multi-Timeframe',
    opportunities: 'Opportunities',
    aiMentor: 'AI Mentor',
    tradeValidator: 'Trade Validator',
    tradingJournal: 'Trading Journal',
    backtesting: 'Backtesting Replay',
    economicNews: 'Economic News',
    voiceAssistant: 'Voice Assistant',
    history: 'History',
    subscription: 'Subscription',
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Log Out',

    // Global UI
    refresh: 'Refresh',
    scanNow: 'Scan Now',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    submit: 'Submit',
    close: 'Close',
    filter: 'Filter',
    all: 'All',
    loading: 'Loading…',
    search: 'Search',
    confidence: 'Probability',
    entry: 'Entry Price',
    stopLoss: 'Stop Loss',
    takeProfit: 'Take Profit',
    rationale: 'Analysis & Rationale',
    confluences: 'Confluences',
    strategy: 'Strategy',
    riskReward: 'Risk/Reward Ratio',

    // Journal
    journalTitle: 'Institutional Trading Journal',
    journalSubtitle: 'Log, track, and measure every trade with ironclad discipline and statistical rigor.',
    newTrade: 'New Trade',
    totalTrades: 'Total Trades',
    winrate: 'Win Rate',
    netPnl: 'Net PnL',
    openTrades: 'Open Trades',
    symbol: 'Asset / Pair',
    direction: 'Direction',
    lotSize: 'Lot Size',
    pnl: 'Profit / Loss ($)',
    status: 'Status',
    emotions: 'Mindset & Psychology',
    notes: 'Execution Notes',
    lessons: 'Lessons Learned',
    noTradesYet: 'No trades recorded yet. Click New Trade to start logging.',

    // Backtesting
    backtestTitle: 'Market Replay & Backtesting Station',
    backtestSubtitle: 'Practice in real-market conditions with bar-by-bar playback, timeline cut, and live order execution.',
    play: 'Play Replay',
    pause: 'Pause',
    stepForward: 'Next Bar',
    reset: 'Reset',
    cutBar: 'Cut Bar (Starting Point)',
    speed: 'Speed',
    simulateBuy: 'Simulate Buy',
    simulateSell: 'Simulate Sell',
    closePosition: 'Close Position',

    // Languages
    language: 'Language',
    french: 'Français',
    english: 'English',
  },
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('acs_lang') || 'fr';
  });

  useEffect(() => {
    localStorage.setItem('acs_lang', lang);
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'fr' ? 'en' : 'fr'));
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations.en?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'fr',
      setLang: () => {},
      toggleLanguage: () => {},
      t: (k) => k,
    };
  }
  return ctx;
};
