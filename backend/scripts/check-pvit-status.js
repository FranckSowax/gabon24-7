/**
 * 🔍 Script de diagnostic PVIT
 *
 * Vérifie l'état du système de paiement PVIT:
 * - Clé PVIT valide
 * - Packages de crédits disponibles
 * - Configuration PVIT
 *
 * Usage: node scripts/check-pvit-status.js
 */

require('dotenv').config();
const { supabase } = require('../config/supabase');

async function checkPvitStatus() {
  console.log('\n🔍 === DIAGNOSTIC PVIT ===\n');

  // 1. Vérifier la configuration
  console.log('📋 1. Configuration PVIT:');
  const config = {
    PVIT_OPERATION_ACCOUNT_CODE: process.env.PVIT_OPERATION_ACCOUNT_CODE,
    PVIT_CALLBACK_URL_CODE: process.env.PVIT_CALLBACK_URL_CODE,
    PVIT_RECEPTION_URL_CODE: process.env.PVIT_RECEPTION_URL_CODE,
    PVIT_SUCCESS_REDIRECTION_CODE: process.env.PVIT_SUCCESS_REDIRECTION_CODE,
    PVIT_FAILED_REDIRECTION_CODE: process.env.PVIT_FAILED_REDIRECTION_CODE,
    PVIT_RENEW_PASSWORD: process.env.PVIT_RENEW_PASSWORD ? '***' : 'NON DÉFINI',
    PVIT_BASE_URL: process.env.PVIT_BASE_URL || 'https://api.mypvit.pro'
  };

  Object.entries(config).forEach(([key, value]) => {
    const status = value && value !== 'NON DÉFINI' ? '✅' : '❌';
    console.log(`   ${status} ${key}: ${value || 'NON DÉFINI'}`);
  });

  // 2. Vérifier la clé PVIT valide
  console.log('\n🔑 2. Clé PVIT:');
  try {
    const { data: keyData, error: keyError } = await supabase
      .from('pvit_current_key')
      .select('*')
      .eq('operation_account_code', process.env.PVIT_OPERATION_ACCOUNT_CODE)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (keyError) {
      console.log('   ❌ Erreur lecture table pvit_current_key:', keyError.message);
    } else if (!keyData || keyData.length === 0) {
      console.log('   ❌ Aucune clé PVIT valide trouvée');
      console.log('   💡 Exécutez: node scripts/insert-pvit-test-key.js');
    } else {
      const key = keyData[0];
      console.log('   ✅ Clé valide trouvée');
      console.log(`   📅 Expire le: ${new Date(key.expires_at).toLocaleString('fr-FR')}`);
      console.log(`   📍 Source: ${key.key_source}`);
      console.log(`   🔐 Clé: ${key.secret_key.substring(0, 15)}...`);
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // 3. Vérifier les packages de crédits
  console.log('\n💳 3. Packages de crédits:');
  try {
    const { data: packages, error: pkgError } = await supabase
      .from('credit_packages')
      .select('id, name, slug, credits, bonus_credits, price_xaf, is_active')
      .order('sort_order', { ascending: true });

    if (pkgError) {
      console.log('   ❌ Erreur lecture table credit_packages:', pkgError.message);
    } else if (!packages || packages.length === 0) {
      console.log('   ❌ Aucun package de crédits trouvé');
      console.log('   💡 Exécutez la migration: 20260102_update_credit_packages.sql');
    } else {
      console.log(`   ✅ ${packages.length} package(s) trouvé(s):`);
      packages.forEach(pkg => {
        const status = pkg.is_active ? '✅' : '⚠️';
        console.log(`   ${status} ${pkg.name} (${pkg.slug}): ${pkg.credits}+${pkg.bonus_credits || 0} crédits = ${pkg.price_xaf} FCFA`);
        console.log(`      ID: ${pkg.id}`);
      });
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // 4. Vérifier les plans d'abonnement
  console.log('\n📦 4. Plans d\'abonnement:');
  try {
    const { data: plans, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, slug, price_monthly, monthly_credits')
      .order('sort_order', { ascending: true });

    if (planError) {
      console.log('   ❌ Erreur lecture table subscription_plans:', planError.message);
    } else if (!plans || plans.length === 0) {
      console.log('   ⚠️ Aucun plan d\'abonnement trouvé');
    } else {
      console.log(`   ✅ ${plans.length} plan(s) trouvé(s):`);
      plans.forEach(plan => {
        console.log(`   - ${plan.name} (${plan.slug}): ${plan.monthly_credits} crédits/mois = ${plan.price_monthly} FCFA/mois`);
      });
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  // 5. Vérifier les derniers paiements
  console.log('\n📊 5. Derniers paiements:');
  try {
    const { data: payments, error: payError } = await supabase
      .from('pvit_payments')
      .select('reference, amount, status, payment_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (payError) {
      console.log('   ❌ Erreur lecture table pvit_payments:', payError.message);
    } else if (!payments || payments.length === 0) {
      console.log('   ℹ️ Aucun paiement enregistré');
    } else {
      console.log(`   📋 ${payments.length} dernier(s) paiement(s):`);
      payments.forEach(pay => {
        const statusIcon = pay.status === 'completed' ? '✅' : pay.status === 'failed' ? '❌' : '⏳';
        console.log(`   ${statusIcon} ${pay.reference}: ${pay.amount} FCFA (${pay.payment_type}) - ${pay.status}`);
      });
    }
  } catch (err) {
    console.log('   ❌ Erreur:', err.message);
  }

  console.log('\n✨ === FIN DU DIAGNOSTIC ===\n');
}

checkPvitStatus()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
  });
