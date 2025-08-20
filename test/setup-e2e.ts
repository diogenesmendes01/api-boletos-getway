import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(30000);

// Mock console.log in tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

// Setup global test environment
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:3000';
process.env.CLIENT_API_KEYS = 'clienteA:token123,clienteB:token456';