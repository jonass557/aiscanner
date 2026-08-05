import crypto from 'crypto';
import config from '../../config/index.js';
import logger from '../../config/logger.js';

/**
 * Symmetric encryption for settings secrets (API keys).
 *
 * Uses AES-256-GCM: authenticated encryption, so tampering is detected on
 * decrypt. The 32-byte key comes from `config.settings.encKey` (env
 * SETTINGS_ENC_KEY). If the configured value isn't exactly 32 bytes we derive
 * one deterministically with SHA-256 so the app still boots, but we warn: a
 * stable, explicitly-set 32-byte key is required to decrypt existing secrets
 * across restarts.
 *
 * Ciphertext format (all base64, dot-separated): `iv.authTag.data`, prefixed
 * with "enc:v1:" so we can recognize (and version) encrypted values.
 */

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';

let warnedWeakKey = false;

const getKey = () => {
  const raw = config.settings?.encKey || '';
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length === 32) return buf;
  if (!warnedWeakKey) {
    logger.warn(
      'SETTINGS_ENC_KEY is not exactly 32 bytes; deriving a key via SHA-256. ' +
        'Set a stable 32-byte SETTINGS_ENC_KEY in the environment for persistent secret storage.'
    );
    warnedWeakKey = true;
  }
  // Deterministic 32-byte fallback so encrypt/decrypt stay consistent within a run.
  return crypto.createHash('sha256').update(raw || 'ai-chart-scanner-default').digest();
};

/** True if a stored value looks like our ciphertext. */
export const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

/**
 * Encrypt a plaintext string. Returns the prefixed ciphertext, or '' for empty
 * input (an empty secret means "cleared", stored as-is).
 */
export const encrypt = (plaintext) => {
  if (plaintext === null || plaintext === undefined || plaintext === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${authTag.toString('base64')}.${data.toString('base64')}`;
};

/**
 * Decrypt a value produced by encrypt(). Returns '' for empty input. If the
 * value isn't recognized as ciphertext it's returned unchanged (tolerates
 * legacy/plaintext rows). Throws only on genuine tampering/corruption.
 */
export const decrypt = (value) => {
  if (!value) return '';
  if (!isEncrypted(value)) return value; // plaintext / legacy
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};

/**
 * Mask a secret for display: keep the last 4 chars, hide the rest.
 * Mirrors the existing mask() used in adminController.getAIConfig.
 */
export const maskSecret = (plaintext) =>
  plaintext ? `${'*'.repeat(8)}${String(plaintext).slice(-4)}` : null;
