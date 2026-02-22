#!/usr/bin/env node
/**
 * 🔑 GET-TOKEN.JS
 * Obtenir le token JWT admin
 */

const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ykytsadwfqoyusleoflf.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Erreur: SUPABASE_ANON_KEY non défini');
  process.exit(1);
}

async function getToken(email, password) {
  console.log('\n🔑 Obtention Token JWT\n');

  try {
    const response = await axios.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      { email, password },
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' } }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    console.log('✅ Token obtenu!\n');
    console.log('🔐 ACCESS TOKEN:');
    console.log(access_token);
    console.log('\n🔄 REFRESH TOKEN:');
    console.log(refresh_token);
    console.log(`\n⏱️  Expire dans: ${expires_in}s`);

    // Sauvegarder
    const fs = require('fs');
    const envContent = `GABON247_ADMIN_TOKEN=${access_token}\nGABON247_REFRESH_TOKEN=${refresh_token}\n`;
    fs.writeFileSync('.env.admin', envContent);
    console.log('\n💾 Token sauvegardé dans .env.admin');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

const email = process.argv[2] || 'admin@gabon247.com';
const password = process.argv[3];

if (!password) {
  console.error('❌ Usage: node get-token.js [email] [password]');
  process.exit(1);
}

getToken(email, password);
