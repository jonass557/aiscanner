/**
 * Unit tests for settings secret encryption. Pure logic (no DB, no network).
 * Verifies the AES-256-GCM round-trip, tolerance of plaintext/legacy values,
 * empty-string handling, and that ciphertext is recognizably prefixed and does
 * not leak the plaintext.
 */
describe('settings/crypto', () => {
  let encrypt;
  let decrypt;
  let isEncrypted;
  let maskSecret;

  beforeAll(async () => {
    // Provide a stable 32-byte key so encrypt/decrypt are consistent.
    process.env.SETTINGS_ENC_KEY = 'x'.repeat(32);
    const mod = await import('../src/services/settings/crypto.js');
    ({ encrypt, decrypt, isEncrypted, maskSecret } = mod);
  });

  it('round-trips a secret value', () => {
    const secret = 'sk-live-ABCDEF1234567890';
    const enc = encrypt(secret);
    expect(enc).not.toBe(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it('produces different ciphertext each time (random IV) but same plaintext', () => {
    const a = encrypt('same-secret');
    const b = encrypt('same-secret');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-secret');
    expect(decrypt(b)).toBe('same-secret');
  });

  it('treats empty input as cleared (empty string)', () => {
    expect(encrypt('')).toBe('');
    expect(encrypt(null)).toBe('');
    expect(encrypt(undefined)).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('returns plaintext/legacy values unchanged on decrypt', () => {
    expect(isEncrypted('plain-value')).toBe(false);
    expect(decrypt('plain-value')).toBe('plain-value');
  });

  it('throws on tampered ciphertext', () => {
    const enc = encrypt('tamper-me');
    const tampered = `${enc}AA`; // corrupt the trailing base64 data
    expect(() => decrypt(tampered)).toThrow();
  });

  it('masks a secret keeping only the last 4 chars', () => {
    expect(maskSecret('sk-1234ABCD')).toBe('********ABCD');
    expect(maskSecret('')).toBeNull();
    expect(maskSecret(null)).toBeNull();
  });
});
