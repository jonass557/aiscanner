import Setting from '../../models/Setting.js';
import config from '../../config/index.js';
import logger from '../../config/logger.js';
import { encrypt, decrypt, maskSecret } from './crypto.js';

/**
 * Settings service — the single seam for runtime-editable configuration.
 *
 * Responsibilities:
 *  1. Define the WHITELIST of admin-editable keys (SETTING_DEFS). Only these
 *     keys can be written, and each declares its category, secrecy, and the
 *     dotted path it overrides in the in-memory `config` object.
 *  2. Persist values to the Setting collection (secrets encrypted).
 *  3. Overlay DB values onto `config` at boot (hydrate) and on every write, so
 *     the rest of the app keeps reading `config.*` with zero knowledge of this
 *     layer. Env remains the bootstrap/fallback; DB overrides it when present.
 *  4. Expose a masked, grouped view for the admin dashboard.
 */

/**
 * Whitelist of editable settings.
 * `path` mirrors the config tree; `secret` marks values that are encrypted at
 * rest and never returned in clear to the client.
 */
export const SETTING_DEFS = [
  // --- Active providers -----------------------------------------------------
  { key: 'ai.provider', path: 'ai.provider', category: 'ai', secret: false },
  { key: 'vision.provider', path: 'vision.provider', category: 'vision', secret: false },

  // --- OpenAI ---------------------------------------------------------------
  { key: 'ai.openai.apiKey', path: 'ai.openai.apiKey', category: 'ai', secret: true },
  { key: 'ai.openai.model', path: 'ai.openai.model', category: 'ai', secret: false },

  // --- Anthropic Claude -----------------------------------------------------
  { key: 'ai.claude.apiKey', path: 'ai.claude.apiKey', category: 'ai', secret: true },
  { key: 'ai.claude.model', path: 'ai.claude.model', category: 'ai', secret: false },

  // --- Google Gemini --------------------------------------------------------
  { key: 'ai.gemini.apiKey', path: 'ai.gemini.apiKey', category: 'ai', secret: true },
  { key: 'ai.gemini.model', path: 'ai.gemini.model', category: 'ai', secret: false },

  // --- NVIDIA AI (open-source vision/text models via NIM) -------------------
  { key: 'ai.nvidia.apiKey', path: 'ai.nvidia.apiKey', category: 'ai', secret: true },
  { key: 'ai.nvidia.model', path: 'ai.nvidia.model', category: 'ai', secret: false },
  { key: 'ai.nvidia.baseUrl', path: 'ai.nvidia.baseUrl', category: 'ai', secret: false },

  // --- Payments: SebPay -----------------------------------------------------
  { key: 'payments.provider', path: 'payments.provider', category: 'payments', secret: false },
  { key: 'payments.sebpay.publicKey', path: 'payments.sebpay.publicKey', category: 'payments', secret: true },
  { key: 'payments.sebpay.secretKey', path: 'payments.sebpay.secretKey', category: 'payments', secret: true },
  { key: 'payments.sebpay.baseUrl', path: 'payments.sebpay.baseUrl', category: 'payments', secret: false },
  { key: 'payments.sebpay.callbackUrl', path: 'payments.sebpay.callbackUrl', category: 'payments', secret: false },
];

const DEF_BY_KEY = new Map(SETTING_DEFS.map((d) => [d.key, d]));

// In-memory cache of decrypted plaintext values, keyed by setting key.
// Invalidated on every write; rebuilt on hydrate.
const cache = new Map();

/** Set a value at a dotted path inside the config object (creates objects). */
const setConfigPath = (path, value) => {
  const parts = path.split('.');
  let node = config;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
};

/** Read the current config value at a dotted path (the env/bootstrap value). */
const getConfigPath = (path) => path.split('.').reduce((n, p) => (n == null ? n : n[p]), config);

/**
 * Load all DB settings, decrypt secrets, populate the cache, and overlay each
 * onto `config`. Safe to call on boot; never throws (falls back to env).
 * @returns {Promise<number>} count of settings applied
 */
export const hydrate = async () => {
  cache.clear();
  let applied = 0;
  try {
    const rows = await Setting.find().lean();
    for (const row of rows) {
      const def = DEF_BY_KEY.get(row.key);
      if (!def) continue; // ignore unknown/legacy keys
      const plain = def.secret ? decrypt(row.value) : row.value;
      if (plain === '' || plain === null || plain === undefined) continue; // don't clobber env with empty
      cache.set(def.key, plain);
      setConfigPath(def.path, plain);
      applied += 1;
    }
    if (applied) logger.info(`Applied ${applied} runtime setting(s) from the database.`);
  } catch (err) {
    logger.warn(`Settings hydration skipped: ${err.message}`);
  }
  return applied;
};

/**
 * Resolve the effective plaintext value for a key: DB override (cache) if set,
 * otherwise the current config (env/bootstrap) value.
 */
export const getValue = (key) => {
  if (cache.has(key)) return cache.get(key);
  const def = DEF_BY_KEY.get(key);
  return def ? getConfigPath(def.path) : undefined;
};

/**
 * Upsert one setting. Encrypts secrets, updates the DB, cache, and live config.
 * An empty string clears the override (falls back to env on next hydrate; for
 * the current process we also clear it from config's overlay via cache delete).
 * @param {string} key
 * @param {string} value - plaintext
 * @param {mongoose.Types.ObjectId} [updatedBy]
 */
export const setValue = async (key, value, updatedBy = null) => {
  const def = DEF_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown setting key: ${key}`);

  const plain = value == null ? '' : String(value);
  const stored = def.secret ? encrypt(plain) : plain;

  await Setting.findOneAndUpdate(
    { key },
    { key, value: stored, category: def.category, isSecret: def.secret, updatedBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (plain === '') {
    cache.delete(def.key);
  } else {
    cache.set(def.key, plain);
    setConfigPath(def.path, plain);
  }
  return def;
};

/** Upsert many settings at once. Accepts an array of { key, value }. */
export const setMany = async (entries, updatedBy = null) => {
  const results = [];
  for (const { key, value } of entries) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await setValue(key, value, updatedBy));
  }
  return results;
};

/**
 * Grouped, client-safe view of all editable settings for the admin UI.
 * Secrets are never returned in clear: only a boolean `configured` and a masked
 * preview. Non-secrets return their effective value.
 */
export const getPublicSettings = () => {
  const grouped = {};
  for (const def of SETTING_DEFS) {
    const effective = getValue(def.key);
    const entry = def.secret
      ? { key: def.key, secret: true, configured: Boolean(effective), preview: maskSecret(effective) }
      : { key: def.key, secret: false, value: effective ?? '' };
    (grouped[def.category] ||= []).push(entry);
  }
  return grouped;
};

export default { SETTING_DEFS, hydrate, getValue, setValue, setMany, getPublicSettings };
