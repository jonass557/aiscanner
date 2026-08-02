import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized configuration.
 * Every environment variable is read here once and exposed as a typed object,
 * so the rest of the app never touches process.env directly.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT, 10) || 5000,

  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chart-scanner',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expire: process.env.JWT_EXPIRE || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: 'ai-chart-scanner',
  },

  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    },
  },
  voice: {
    // 'web-speech' (default, client-side, zero-config) or 'openai' (server-side Whisper/TTS).
    provider: process.env.VOICE_PROVIDER || 'web-speech',
    openai: {
      apiKey: process.env.VOICE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      sttModel: process.env.VOICE_STT_MODEL || 'whisper-1',
      ttsModel: process.env.VOICE_TTS_MODEL || 'tts-1',
      ttsVoice: process.env.VOICE_TTS_VOICE || 'alloy',
    },
  },

  marketData: {
    // Crypto uses Binance public endpoints (no key). Forex/indices/commodities
    // use TwelveData when a key is set; everything else falls back to mock.
    binance: {
      baseUrl: process.env.BINANCE_BASE_URL || 'https://api.binance.com',
    },
    twelveData: {
      apiKey: process.env.TWELVEDATA_API_KEY,
      baseUrl: process.env.TWELVEDATA_BASE_URL || 'https://api.twelvedata.com',
    },
  },

  payments: {
    // 'sebpay' for real Mobile Money, or 'demo' (default) for instant test approvals.
    provider: process.env.PAYMENT_PROVIDER || (process.env.SEBPAY_SECRET_KEY ? 'sebpay' : 'demo'),
    currency: process.env.PAYMENT_CURRENCY || 'XOF',
    sebpay: {
      publicKey: process.env.SEBPAY_PUBLIC_KEY,
      secretKey: process.env.SEBPAY_SECRET_KEY,
      baseUrl: process.env.SEBPAY_BASE_URL || 'https://new.sebpay.bj/api',
      // Public URL SebPay POSTs webhooks to (e.g. https://api.yourapp.com/api/v1/payments/webhook/sebpay).
      callbackUrl: process.env.SEBPAY_CALLBACK_URL,
    },
  },

  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@aichartscanner.com',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024,
    allowedFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  },

  rateLimit: {
    windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@aichartscanner.com',
    password: process.env.ADMIN_PASSWORD || 'Admin123!ChangeThis',
  },
};

export default config;
