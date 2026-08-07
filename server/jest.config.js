export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  // Clear provider keys before any app module loads, so tests never hit the
  // network and always use the deterministic mock provider.
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  verbose: true,
  forceExit: true,
  // Generous timeout: the first run downloads an in-memory MongoDB binary,
  // and the beforeAll hook must cover that one-time cost.
  testTimeout: 120000,
};
