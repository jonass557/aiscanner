import mongoose from 'mongoose';

/**
 * Runtime setting — a single key/value pair the admin can edit from the
 * dashboard without a redeploy (API keys, active provider, model names…).
 *
 * Secret values (API keys) are stored ENCRYPTED (AES-256-GCM) in `value`;
 * non-secret values (provider name, model id) are stored in clear. The
 * `isSecret` flag tells the settings service which is which so it never
 * decrypts a plaintext value or leaks a secret to the client.
 *
 * The environment (`config/index.js`) remains the bootstrap/fallback source:
 * on read, a DB setting OVERRIDES the env value; if absent, env wins.
 */
const settingSchema = new mongoose.Schema(
  {
    // Dotted path mirroring the config tree, e.g. 'ai.claude.apiKey',
    // 'vision.provider', 'vision.nvidia.model', 'payments.sebpay.secretKey'.
    key: { type: String, required: true, unique: true, trim: true },

    // Encrypted (secret) or plain (non-secret) string. Always a string;
    // callers coerce as needed. Empty string means "cleared".
    value: { type: String, default: '' },

    // Grouping for the admin UI and bulk reads.
    category: {
      type: String,
      enum: ['ai', 'vision', 'payments', 'general'],
      default: 'general',
      index: true,
    },

    // When true, `value` is AES-256-GCM ciphertext and is never returned raw.
    isSecret: { type: Boolean, default: false },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
