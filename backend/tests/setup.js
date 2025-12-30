// Configuration globale pour les tests Jest
require('dotenv').config({ path: '.env.test' });

// Mock des variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SENDGRID_API_KEY = 'SG.test-key';
process.env.SENDGRID_FROM_EMAIL = 'test@gabon-insight.com';

// Augmenter le timeout pour les tests asynchrones
jest.setTimeout(10000);

// Mock console pour réduire le bruit dans les tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
