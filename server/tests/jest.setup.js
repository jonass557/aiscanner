/**
 * Jest global pre-test setup (runs once per test file, BEFORE any app module —
 * and therefore before config/index.js calls dotenv.config()).
 *
 * Purpose: make the whole test suite HERMETIC. The local .env may define real
 * provider keys (e.g. GEMINI_API_KEY) for development; if those leak into the
 * test run, scans hit the real network — slow, flaky, and non-deterministic.
 *
 * dotenv never overrides an already-present process.env var, so by pinning
 * these to empty here we guarantee config sees "no key configured" and the
 * deterministic mock provider is used end-to-end (perception + reasoning).
 */
for (const key of [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'NVIDIA_API_KEY',
  'VOICE_OPENAI_API_KEY',
]) {
  process.env[key] = '';
}
process.env.AI_PROVIDER = 'mock';
process.env.VISION_PROVIDER = 'mock';
