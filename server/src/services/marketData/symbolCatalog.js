/**
 * Canonical symbol catalog for the market-data layer.
 *
 * `resolveSymbol()` maps whatever the user typed ("EURUSD", "or", "Boom & Crash")
 * to a canonical symbol + market + (optional) Binance/TwelveData mapping.
 *
 * Base prices are used ONLY by the mock provider (deterministic fallback) so the
 * app works zero-config in development. Real providers override with live data.
 */

export const SYMBOL_CATALOG = [
  // Forex Majors
  { symbol: 'EURUSD', market: 'forex', label: 'EUR/USD', base: 1.0865 },
  { symbol: 'GBPUSD', market: 'forex', label: 'GBP/USD', base: 1.271 },
  { symbol: 'USDJPY', market: 'forex', label: 'USD/JPY', base: 156.2 },
  { symbol: 'USDCHF', market: 'forex', label: 'USD/CHF', base: 0.904 },
  { symbol: 'AUDUSD', market: 'forex', label: 'AUD/USD', base: 0.664 },
  { symbol: 'USDCAD', market: 'forex', label: 'USD/CAD', base: 1.368 },
  { symbol: 'NZDUSD', market: 'forex', label: 'NZD/USD', base: 0.61 },

  // Forex Minors & Crosses
  { symbol: 'EURGBP', market: 'forex', label: 'EUR/GBP', base: 0.855 },
  { symbol: 'EURJPY', market: 'forex', label: 'EUR/JPY', base: 169.7 },
  { symbol: 'GBPJPY', market: 'forex', label: 'GBP/JPY', base: 198.4 },
  { symbol: 'EURAUD', market: 'forex', label: 'EUR/AUD', base: 1.636 },
  { symbol: 'EURCAD', market: 'forex', label: 'EUR/CAD', base: 1.486 },
  { symbol: 'EURCHF', market: 'forex', label: 'EUR/CHF', base: 0.982 },
  { symbol: 'EURNZD', market: 'forex', label: 'EUR/NZD', base: 1.778 },
  { symbol: 'GBPAUD', market: 'forex', label: 'GBP/AUD', base: 1.913 },
  { symbol: 'GBPCAD', market: 'forex', label: 'GBP/CAD', base: 1.738 },
  { symbol: 'GBPCHF', market: 'forex', label: 'GBP/CHF', base: 1.148 },
  { symbol: 'GBPNZD', market: 'forex', label: 'GBP/NZD', base: 2.082 },
  { symbol: 'AUDCAD', market: 'forex', label: 'AUD/CAD', base: 0.908 },
  { symbol: 'AUDCHF', market: 'forex', label: 'AUD/CHF', base: 0.601 },
  { symbol: 'AUDJPY', market: 'forex', label: 'AUD/JPY', base: 103.7 },
  { symbol: 'AUDNZD', market: 'forex', label: 'AUD/NZD', base: 1.088 },
  { symbol: 'CADCHF', market: 'forex', label: 'CAD/CHF', base: 0.661 },
  { symbol: 'CADJPY', market: 'forex', label: 'CAD/JPY', base: 114.2 },
  { symbol: 'CHFJPY', market: 'forex', label: 'CHF/JPY', base: 172.8 },
  { symbol: 'NZDCAD', market: 'forex', label: 'NZD/CAD', base: 0.835 },
  { symbol: 'NZDCHF', market: 'forex', label: 'NZD/CHF', base: 0.552 },
  { symbol: 'NZDJPY', market: 'forex', label: 'NZD/JPY', base: 95.3 },

  // Forex Exotics
  { symbol: 'USDZAR', market: 'forex', label: 'USD/ZAR (Rand)', base: 18.25 },
  { symbol: 'USDMXN', market: 'forex', label: 'USD/MXN (Peso)', base: 19.85 },
  { symbol: 'USDTRY', market: 'forex', label: 'USD/TRY (Livre Turque)', base: 34.25 },
  { symbol: 'USDBRL', market: 'forex', label: 'USD/BRL (Real Brésilien)', base: 5.65 },
  { symbol: 'USDSEK', market: 'forex', label: 'USD/SEK (Couronne)', base: 10.42 },
  { symbol: 'USDNOK', market: 'forex', label: 'USD/NOK (Couronne)', base: 10.88 },
  { symbol: 'USDPLN', market: 'forex', label: 'USD/PLN (Zloty)', base: 3.96 },
  { symbol: 'USDSGD', market: 'forex', label: 'USD/SGD (Dollar Sing.)', base: 1.312 },
  { symbol: 'USDHKD', market: 'forex', label: 'USD/HKD (Dollar HK)', base: 7.77 },
  { symbol: 'USDCNH', market: 'forex', label: 'USD/CNH (Yuan Offshore)', base: 7.12 },
  { symbol: 'EURTRY', market: 'forex', label: 'EUR/TRY', base: 37.2 },
  { symbol: 'EURZAR', market: 'forex', label: 'EUR/ZAR', base: 19.82 },
  { symbol: 'GBPZAR', market: 'forex', label: 'GBP/ZAR', base: 23.2 },

  // Commodities & Metals
  { symbol: 'XAUUSD', market: 'commodities', label: 'Gold (XAU/USD)', base: 2685.0 },
  { symbol: 'XAGUSD', market: 'commodities', label: 'Silver (XAG/USD)', base: 31.8 },
  { symbol: 'XPTUSD', market: 'commodities', label: 'Platinum (XPT/USD)', base: 980.0 },
  { symbol: 'XPDUSD', market: 'commodities', label: 'Palladium (XPD/USD)', base: 1060.0 },
  { symbol: 'COPPER', market: 'commodities', label: 'Copper', base: 4.35 },
  { symbol: 'USOIL', market: 'commodities', label: 'WTI Crude Oil', base: 74.5 },
  { symbol: 'UKOIL', market: 'commodities', label: 'Brent Crude Oil', base: 78.2 },

  // Crypto (Binance & Real public feeds)
  { symbol: 'BTCUSD', market: 'crypto', label: 'Bitcoin (BTC/USD)', base: 68400, binance: 'BTCUSDT' },
  { symbol: 'ETHUSD', market: 'crypto', label: 'Ethereum (ETH/USD)', base: 2640, binance: 'ETHUSDT' },
  { symbol: 'SOLUSD', market: 'crypto', label: 'Solana (SOL/USD)', base: 158.0, binance: 'SOLUSDT' },
  { symbol: 'XRPUSD', market: 'crypto', label: 'XRP (XRP/USD)', base: 0.548, binance: 'XRPUSDT' },
  { symbol: 'BNBUSD', market: 'crypto', label: 'BNB (BNB/USD)', base: 595, binance: 'BNBUSDT' },
  { symbol: 'ADAUSD', market: 'crypto', label: 'Cardano (ADA/USD)', base: 0.355, binance: 'ADAUSDT' },
  { symbol: 'DOGEUSD', market: 'crypto', label: 'Dogecoin (DOGE/USD)', base: 0.142, binance: 'DOGEUSDT' },
  { symbol: 'AVAXUSD', market: 'crypto', label: 'Avalanche (AVAX/USD)', base: 26.5, binance: 'AVAXUSDT' },
  { symbol: 'LINKUSD', market: 'crypto', label: 'Chainlink (LINK/USD)', base: 11.8, binance: 'LINKUSDT' },
  { symbol: 'DOTUSD', market: 'crypto', label: 'Polkadot (DOT/USD)', base: 4.25, binance: 'DOTUSDT' },
  { symbol: 'NEARUSD', market: 'crypto', label: 'NEAR Protocol (NEAR/USD)', base: 4.85, binance: 'NEARUSDT' },
  { symbol: 'SUIUSD', market: 'crypto', label: 'Sui Network (SUI/USD)', base: 2.15, binance: 'SUIUSDT' },
  { symbol: 'MATICUSD', market: 'crypto', label: 'Polygon (MATIC/USD)', base: 0.38, binance: 'POLUSDT' },
  { symbol: 'LTCUSD', market: 'crypto', label: 'Litecoin (LTC/USD)', base: 71.5, binance: 'LTCUSDT' },
  { symbol: 'SHIBUSD', market: 'crypto', label: 'Shiba Inu (SHIB/USD)', base: 0.0000185, binance: 'SHIBUSDT' },

  // Major World Indices
  { symbol: 'US30', market: 'indices', label: 'Dow Jones (US30)', base: 43250 },
  { symbol: 'NAS100', market: 'indices', label: 'Nasdaq 100 (NAS100)', base: 20450 },
  { symbol: 'SPX500', market: 'indices', label: 'S&P 500 (SPX500)', base: 5860 },
  { symbol: 'GER40', market: 'indices', label: 'DAX 40 (GER40)', base: 19550 },
  { symbol: 'UK100', market: 'indices', label: 'FTSE 100 (UK100)', base: 8250 },
  { symbol: 'FRA40', market: 'indices', label: 'CAC 40 (FRA40)', base: 7520 },
  { symbol: 'JPN225', market: 'indices', label: 'Nikkei 225 (JPN225)', base: 38950 },
  { symbol: 'EUSTX50', market: 'indices', label: 'Euro Stoxx 50 (EUSTX50)', base: 4920 },
  { symbol: 'AUS200', market: 'indices', label: 'ASX 200 (AUS200)', base: 8150 },
  { symbol: 'HK50', market: 'indices', label: 'Hang Seng 50 (HK50)', base: 20500 },

  // Deriv Synthetics
  { symbol: 'Volatility 75 Index', market: 'synthetic', label: 'Volatility 75 Index', base: 325400 },
  { symbol: 'Volatility 100 Index', market: 'synthetic', label: 'Volatility 100 Index', base: 1840 },
  { symbol: 'Volatility 50 Index', market: 'synthetic', label: 'Volatility 50 Index', base: 412.5 },
  { symbol: 'Volatility 25 Index', market: 'synthetic', label: 'Volatility 25 Index', base: 2450 },
  { symbol: 'Volatility 10 Index', market: 'synthetic', label: 'Volatility 10 Index', base: 1250 },
  { symbol: 'Volatility 75 (1s) Index', market: 'synthetic', label: 'Volatility 75 (1s) Index', base: 425000 },
  { symbol: 'Volatility 100 (1s) Index', market: 'synthetic', label: 'Volatility 100 (1s) Index', base: 1250 },
  { symbol: 'Volatility 50 (1s) Index', market: 'synthetic', label: 'Volatility 50 (1s) Index', base: 530 },
  { symbol: 'Volatility 25 (1s) Index', market: 'synthetic', label: 'Volatility 25 (1s) Index', base: 3200 },
  { symbol: 'Volatility 10 (1s) Index', market: 'synthetic', label: 'Volatility 10 (1s) Index', base: 980 },
  { symbol: 'Volatility 150 (1s) Index', market: 'synthetic', label: 'Volatility 150 (1s) Index', base: 760 },
  { symbol: 'Volatility 250 (1s) Index', market: 'synthetic', label: 'Volatility 250 (1s) Index', base: 1450 },
  { symbol: 'Boom 1000 Index', market: 'synthetic', label: 'Boom 1000 Index', base: 12500 },
  { symbol: 'Crash 1000 Index', market: 'synthetic', label: 'Crash 1000 Index', base: 6400 },
  { symbol: 'Boom 500 Index', market: 'synthetic', label: 'Boom 500 Index', base: 4820 },
  { symbol: 'Crash 500 Index', market: 'synthetic', label: 'Crash 500 Index', base: 3910 },
  { symbol: 'Boom 300 Index', market: 'synthetic', label: 'Boom 300 Index', base: 3200 },
  { symbol: 'Crash 300 Index', market: 'synthetic', label: 'Crash 300 Index', base: 2800 },
  { symbol: 'Step Index', market: 'synthetic', label: 'Step Index', base: 8420 },
  { symbol: 'Step 200 Index', market: 'synthetic', label: 'Step 200 Index', base: 4200 },
  { symbol: 'Step 500 Index', market: 'synthetic', label: 'Step 500 Index', base: 2150 },
  { symbol: 'Range Break 100 Index', market: 'synthetic', label: 'Range Break 100 Index', base: 5120 },
  { symbol: 'Range Break 200 Index', market: 'synthetic', label: 'Range Break 200 Index', base: 7850 },
  { symbol: 'Jump 10 Index', market: 'synthetic', label: 'Jump 10 Index', base: 1100 },
  { symbol: 'Jump 25 Index', market: 'synthetic', label: 'Jump 25 Index', base: 2350 },
  { symbol: 'Jump 50 Index', market: 'synthetic', label: 'Jump 50 Index', base: 4650 },
  { symbol: 'Jump 75 Index', market: 'synthetic', label: 'Jump 75 Index', base: 6950 },
  { symbol: 'Jump 100 Index', market: 'synthetic', label: 'Jump 100 Index', base: 9200 },
];

// Aliases so natural-language mentions resolve ("or", "gold", "btc", "booms").
const ALIASES = {
  eurusd: 'EURUSD', 'eur/usd': 'EURUSD', euro: 'EURUSD',
  gbpusd: 'GBPUSD', 'gbp/usd': 'GBPUSD', cable: 'GBPUSD', livre: 'GBPUSD',
  usdjpy: 'USDJPY', 'usd/jpy': 'USDJPY',
  audusd: 'AUDUSD', 'aud/usd': 'AUDUSD',
  usdcad: 'USDCAD', 'usd/cad': 'USDCAD',
  nzdusd: 'NZDUSD', 'nzd/usd': 'NZDUSD',
  usdchf: 'USDCHF', 'usd/chf': 'USDCHF',
  euraud: 'EURAUD', 'eur/aud': 'EURAUD',
  eurgbp: 'EURGBP', 'eur/gbp': 'EURGBP',
  eurjpy: 'EURJPY', 'eur/jpy': 'EURJPY',
  gbpjpy: 'GBPJPY', 'gbp/jpy': 'GBPJPY', guppy: 'GBPJPY',
  audjpy: 'AUDJPY', 'aud/jpy': 'AUDJPY',
  eurcad: 'EURCAD', 'eur/cad': 'EURCAD',
  eurchf: 'EURCHF', 'eur/chf': 'EURCHF',
  eurnzd: 'EURNZD', 'eur/nzd': 'EURNZD',
  gbpaud: 'GBPAUD', 'gbp/aud': 'GBPAUD',
  gbpcad: 'GBPCAD', 'gbp/cad': 'GBPCAD',
  gbpchf: 'GBPCHF', 'gbp/chf': 'GBPCHF',
  gbpnzd: 'GBPNZD', 'gbp/nzd': 'GBPNZD',
  audcad: 'AUDCAD', 'aud/cad': 'AUDCAD',
  audchf: 'AUDCHF', 'aud/chf': 'AUDCHF',
  audnzd: 'AUDNZD', 'aud/nzd': 'AUDNZD',
  cadchf: 'CADCHF', 'cad/chf': 'CADCHF',
  cadjpy: 'CADJPY', 'cad/jpy': 'CADJPY',
  chfjpy: 'CHFJPY', 'chf/jpy': 'CHFJPY',
  nzdcad: 'NZDCAD', 'nzd/cad': 'NZDCAD',
  nzdchf: 'NZDCHF', 'nzd/chf': 'NZDCHF',
  nzdjpy: 'NZDJPY', 'nzd/jpy': 'NZDJPY',
  usdzar: 'USDZAR', 'usd/zar': 'USDZAR', rand: 'USDZAR',
  usdmxn: 'USDMXN', 'usd/mxn': 'USDMXN', peso: 'USDMXN',
  usdtry: 'USDTRY', 'usd/try': 'USDTRY',
  usdbrl: 'USDBRL', 'usd/brl': 'USDBRL', real: 'USDBRL',
  usdsek: 'USDSEK', 'usd/sek': 'USDSEK',
  usdnok: 'USDNOK', 'usd/nok': 'USDNOK',
  usdpln: 'USDPLN', 'usd/pln': 'USDPLN',
  usdsgd: 'USDSGD', 'usd/sgd': 'USDSGD',
  usdhkd: 'USDHKD', 'usd/hkd': 'USDHKD',
  usdcnh: 'USDCNH', 'usd/cnh': 'USDCNH', cnh: 'USDCNH',
  eurtry: 'EURTRY', 'eur/try': 'EURTRY',
  eurzar: 'EURZAR', 'eur/zar': 'EURZAR',
  gbpzar: 'GBPZAR', 'gbp/zar': 'GBPZAR',
  xauusd: 'XAUUSD', 'xau/usd': 'XAUUSD', or: 'XAUUSD', gold: 'XAUUSD', 'gold/usd': 'XAUUSD',
  xagusd: 'XAGUSD', 'xag/usd': 'XAGUSD', argent: 'XAGUSD', silver: 'XAGUSD',
  usoil: 'USOIL', wti: 'USOIL', oil: 'USOIL', petrole: 'USOIL', 'us oil': 'USOIL',
  ukoil: 'UKOIL', brent: 'UKOIL',
  btcusd: 'BTCUSD', btc: 'BTCUSD', bitcoin: 'BTCUSD', 'btc/usd': 'BTCUSD', 'btc-usd': 'BTCUSD', btcusdt: 'BTCUSD',
  ethusd: 'ETHUSD', eth: 'ETHUSD', ethereum: 'ETHUSD', 'eth/usd': 'ETHUSD', 'eth-usd': 'ETHUSD', ethusdt: 'ETHUSD',
  solusd: 'SOLUSD', sol: 'SOLUSD', solana: 'SOLUSD', 'sol/usd': 'SOLUSD', 'sol-usd': 'SOLUSD', solusdt: 'SOLUSD',
  xrpusd: 'XRPUSD', xrp: 'XRPUSD', 'xrp/usd': 'XRPUSD', 'xrp-usd': 'XRPUSD', xrpusdt: 'XRPUSD',
  bnbusd: 'BNBUSD', bnb: 'BNBUSD', 'bnb/usd': 'BNBUSD', 'bnb-usd': 'BNBUSD', bnbusdt: 'BNBUSD',
  adausd: 'ADAUSD', ada: 'ADAUSD', 'ada/usd': 'ADAUSD', adausdt: 'ADAUSD',
  dogeusd: 'DOGEUSD', doge: 'DOGEUSD', 'doge/usd': 'DOGEUSD', dogeusdt: 'DOGEUSD',
  us30: 'US30', 'us 30': 'US30', 'us/30': 'US30', dow: 'US30', 'dow jones': 'US30', dji: 'US30', '^dji': 'US30',
  nas100: 'NAS100', us100: 'NAS100', 'us 100': 'NAS100', 'nas/100': 'NAS100', 'us/100': 'NAS100', nasdaq: 'NAS100', 'nas 100': 'NAS100', ustec: 'NAS100', '^ixic': 'NAS100',
  spx500: 'SPX500', us500: 'SPX500', 'us 500': 'SPX500', 'spx/500': 'SPX500', 'us/500': 'SPX500', 'spx 500': 'SPX500', sp500: 'SPX500', 's&p': 'SPX500', '^gspc': 'SPX500',
  ger40: 'GER40', 'ger 40': 'GER40', 'ger/40': 'GER40', dax: 'GER40', dax40: 'GER40', de40: 'GER40', '^gdaxi': 'GER40',
  uk100: 'UK100', 'uk 100': 'UK100', 'uk/100': 'UK100', ftse: 'UK100', '^ftse': 'UK100',
  fra40: 'FRA40', 'fra 40': 'FRA40', cac40: 'FRA40', '^fchi': 'FRA40',
  jpn225: 'JPN225', 'jpn 225': 'JPN225', nikkei: 'JPN225', '^n225': 'JPN225',
  'volatility 75': 'Volatility 75 Index', 'vol 75': 'Volatility 75 Index', v75: 'Volatility 75 Index', vol75: 'Volatility 75 Index', 'volatility 75 index': 'Volatility 75 Index',
  'volatility 100': 'Volatility 100 Index', 'vol 100': 'Volatility 100 Index', v100: 'Volatility 100 Index', vol100: 'Volatility 100 Index', 'volatility 100 index': 'Volatility 100 Index',
  'volatility 50': 'Volatility 50 Index', 'vol 50': 'Volatility 50 Index', v50: 'Volatility 50 Index', vol50: 'Volatility 50 Index', 'volatility 50 index': 'Volatility 50 Index',
  'volatility 25': 'Volatility 25 Index', 'vol 25': 'Volatility 25 Index', v25: 'Volatility 25 Index', vol25: 'Volatility 25 Index', 'volatility 25 index': 'Volatility 25 Index',
  'volatility 10': 'Volatility 10 Index', 'vol 10': 'Volatility 10 Index', v10: 'Volatility 10 Index', vol10: 'Volatility 10 Index', 'volatility 10 index': 'Volatility 10 Index',
  'boom 1000': 'Boom 1000 Index', boom1000: 'Boom 1000 Index', boom: 'Boom 1000 Index', 'boom & crash': 'Boom 1000 Index', 'boom 1000 index': 'Boom 1000 Index',
  'crash 1000': 'Crash 1000 Index', crash1000: 'Crash 1000 Index', crash: 'Crash 1000 Index', 'crash 1000 index': 'Crash 1000 Index',
  'boom 500': 'Boom 500 Index', boom500: 'Boom 500 Index', 'boom 500 index': 'Boom 500 Index',
  'crash 500': 'Crash 500 Index', crash500: 'Crash 500 Index', 'crash 500 index': 'Crash 500 Index',
  'boom 300': 'Boom 300 Index', boom300: 'Boom 300 Index', 'boom 300 index': 'Boom 300 Index',
  'crash 300': 'Crash 300 Index', crash300: 'Crash 300 Index', 'crash 300 index': 'Crash 300 Index',
  step: 'Step Index', 'step index': 'Step Index', stepindex: 'Step Index',
  'step 200': 'Step 200 Index', step200: 'Step 200 Index',
  'step 500': 'Step 500 Index', step500: 'Step 500 Index',
  'range break 100': 'Range Break 100 Index', rangebreak100: 'Range Break 100 Index',
  'range break 200': 'Range Break 200 Index', rangebreak200: 'Range Break 200 Index',
  'jump 10': 'Jump 10 Index', jump10: 'Jump 10 Index',
  'jump 25': 'Jump 25 Index', jump25: 'Jump 25 Index',
  'jump 50': 'Jump 50 Index', jump50: 'Jump 50 Index',
  'jump 75': 'Jump 75 Index', jump75: 'Jump 75 Index',
  'jump 100': 'Jump 100 Index', jump100: 'Jump 100 Index',
  'volatility 75 (1s)': 'Volatility 75 (1s) Index', 'vol 75 (1s)': 'Volatility 75 (1s) Index', 'vol75 1s': 'Volatility 75 (1s) Index', vol751s: 'Volatility 75 (1s) Index',
  'volatility 100 (1s)': 'Volatility 100 (1s) Index', 'vol 100 (1s)': 'Volatility 100 (1s) Index', vol1001s: 'Volatility 100 (1s) Index',
  'volatility 50 (1s)': 'Volatility 50 (1s) Index', 'vol 50 (1s)': 'Volatility 50 (1s) Index', vol501s: 'Volatility 50 (1s) Index',
  'volatility 25 (1s)': 'Volatility 25 (1s) Index', 'vol 25 (1s)': 'Volatility 25 (1s) Index', vol251s: 'Volatility 25 (1s) Index',
  'volatility 10 (1s)': 'Volatility 10 (1s) Index', 'vol 10 (1s)': 'Volatility 10 (1s) Index', vol101s: 'Volatility 10 (1s) Index',
  'volatility 150 (1s)': 'Volatility 150 (1s) Index', vol1501s: 'Volatility 150 (1s) Index',
  'volatility 250 (1s)': 'Volatility 250 (1s) Index', vol2501s: 'Volatility 250 (1s) Index',
  xptusd: 'XPTUSD', platine: 'XPTUSD', platinum: 'XPTUSD',
  xpdusd: 'XPDUSD', palladium: 'XPDUSD',
  copper: 'COPPER', cuivre: 'COPPER',
  avaxusd: 'AVAXUSD', avax: 'AVAXUSD',
  linkusd: 'LINKUSD', link: 'LINKUSD',
  dotusd: 'DOTUSD', dot: 'DOTUSD',
  nearusd: 'NEARUSD', near: 'NEARUSD',
  suiusd: 'SUIUSD', sui: 'SUIUSD',
  maticusd: 'MATICUSD', matic: 'MATICUSD', pol: 'MATICUSD',
  ltcusd: 'LTCUSD', ltc: 'LTCUSD', litecoin: 'LTCUSD',
  shibusd: 'SHIBUSD', shib: 'SHIBUSD',
  eustx50: 'EUSTX50', stoxx50: 'EUSTX50',
  aus200: 'AUS200', asx200: 'AUS200',
  hk50: 'HK50', hsi: 'HK50',
};

// Market filters from the prompt: "indices synthétiques Deriv", "Boom & Crash", "crypto"…
export const MARKET_KEYWORDS = {
  synthetic: ['synthetique', 'synthetic', 'deriv', 'boom', 'crash', 'volatility', 'vol 75', 'vol 100'],
  crypto: ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'xrp'],
  forex: ['forex', 'eur', 'gbp', 'usd', 'devises'],
  indices: ['indice', 'indices', 'index', 'bourse', 'us30', 'nasdaq', 'sp500'],
  commodities: ['commoditie', 'or', 'gold', 'argent', 'silver', 'petrole', 'oil'],
};

/**
 * Canonicalize a raw user mention into a catalog entry (or null).
 * @param {string} text
 * @param {Object} [opts]
 * @param {boolean} [opts.fuzzy=true] - allow substring matching (off for short tokens)
 * @returns {Object|null} { symbol, market, label, base, binance? }
 */
export const resolveSymbol = (text, { fuzzy = true } = {}) => {
  if (!text) return null;
  const norm = String(text).trim().toLowerCase().replace(/[^\w\s/.-]/g, '');
  if (!norm) return null;
  // Exact catalog symbol first.
  const direct = SYMBOL_CATALOG.find((s) => s.symbol.toLowerCase() === norm);
  if (direct) return direct;
  // Alias lookup (exact or unslashed).
  const unslashed = norm.replace(/[/\s._-]/g, '');
  const viaAlias = ALIASES[norm] || ALIASES[unslashed];
  if (viaAlias) return SYMBOL_CATALOG.find((s) => s.symbol === viaAlias) || null;
  const directUnslashed = SYMBOL_CATALOG.find((s) => s.symbol.toLowerCase() === unslashed);
  if (directUnslashed) return directUnslashed;
  // Fuzzy substring — only for tokens long enough to be unambiguous (avoids
  // "et" matching "ethusd"). Requires 4+ chars.
  if (fuzzy && norm.length >= 4) {
    const f = SYMBOL_CATALOG.find(
      (s) => s.symbol.toLowerCase().includes(norm) || norm.includes(s.symbol.toLowerCase())
    );
    if (f) return f;
  }
  return null;
};

/** Infer a market filter from text ("analyse uniquement les indices synthétiques Deriv"). */
export const inferMarket = (text) => {
  const norm = String(text || '').toLowerCase();
  for (const [market, keywords] of Object.entries(MARKET_KEYWORDS)) {
    if (keywords.some((k) => norm.includes(k))) return market;
  }
  return null;
};

export const MARKET_LABELS = {
  forex: 'Forex',
  crypto: 'Crypto',
  indices: 'Indices',
  commodities: 'Commodities',
  synthetic: 'Deriv Synthétiques',
  unknown: 'Inconnu',
};
