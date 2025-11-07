module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'server.js',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: [],
  testTimeout: 30000, // 30 second timeout for integration tests
  verbose: true
};