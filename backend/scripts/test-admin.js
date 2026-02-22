#!/usr/bin/env node
/**
 * ✅ TEST-ADMIN.JS
 * Tester les endpoints admin
 */

const axios = require('axios');

const API_URL = process.env.GABON247_API_URL || 'https://gabon24-7-production.up.railway.app';
const ADMIN_TOKEN = process.argv[2] || process.env.GABON247_ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('❌ Token manquant');
  console.log('Usage: node test-admin.js [token]');
  process.exit(1);
}

const endpoints = [
  { name: 'Santé App', path: '/health', auth: false },
  { name: 'Monitoring APM', path: '/api/monitoring/health', auth: false },
  { name: 'Dashboard Admin', path: '/api/admin/dashboard', auth: true },
  { name: 'AI Status', path: '/api/ai/admin/status', auth: true },
  { name: 'Credits Packages', path: '/api/credits/packages', auth: false }
];

async function testEndpoint(name, path, requiresAuth) {
  const url = `${API_URL}${path}`;
  const headers = requiresAuth ? { 'Authorization': `Bearer ${ADMIN_TOKEN}` } : {};

  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    return { name, status: '✅ OK', code: response.status };
  } catch (error) {
    return { name, status: '❌ ERREUR', code: error.response?.status || 'N/A', error: error.message };
  }
}

async function runTests() {
  console.log('\n🧪 TEST DES ENDPOINTS\n');

  for (const endpoint of endpoints) {
    process.stdout.write(`⏳ ${endpoint.name}... `);
    const result = await testEndpoint(endpoint.name, endpoint.path, endpoint.auth);
    console.log(result.status);
  }

  console.log('\n✅ Tests terminés');
}

runTests();
