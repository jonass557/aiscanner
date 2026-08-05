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
      model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    },
    // NVIDIA AI — open-source vision/text models served via NVIDIA NIM
    // (build.nvidia.com), OpenAI-compatible chat/completions API.
    nvidia: {
      apiKey: process.env.NVIDIA_API_KEY,
      model: process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct',
      baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    },
  },

  // Vision engine: which provider performs chart PERCEPTION (Computer Vision).
  // Independent from ai.provider (which drives reasoning/chat) so the two can
  // be swapped separately from the admin dashboard.
  vision: {
    provider: process.env.VISION_PROVIDER || process.env.AI_PROVIDER || 'openai',
  },

  // Encryption key for settings secrets (API keys) stored in the database.
  // Must be a stable 32-byte string in production (see services/settings/crypto.js).
  settings: {
    encKey: process.env.SETTINGS_ENC_KEY || '',
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
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@aichartscanner.com',
    // Resend HTTP API (recommended on hosts that block outbound SMTP, e.g.
    // Render). When RESEND_API_KEY is set, it is used before falling back to SMTP.
    resendApiKey: process.env.RESEND_API_KEY,
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

  // Feature flags — toggle product behaviors without code changes.
  features: {
    // Gate sensitive actions (scan, multi-timeframe, trade validator) behind a
    // verified email. Default OFF so the product is usable without a working
    // email provider. Togglable at runtime from the admin dashboard
    // (features.requireEmailVerification setting), which overrides this env.
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
  },
};

export default config;
