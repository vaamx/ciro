// Load environment variables from .env file for tests
require('dotenv').config();

// Increase timeout for integration tests
jest.setTimeout(30000);

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
} 