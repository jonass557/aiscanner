export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  forceExit: true,
  // Generous timeout: the first run downloads an in-memory MongoDB binary,
  // and the beforeAll hook must cover that one-time cost.
  testTimeout: 120000,
};
