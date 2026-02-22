#!/usr/bin/env node
/**
 * 🔐 CREATE-ADMIN.JS
 * Crée un utilisateur admin pour Gabon 24/7
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ykytsadwfqoyusleoflf.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Erreur: SUPABASE_SERVICE_KEY non défini');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createAdmin() {
  console.log('\n🚀 Création Administrateur Gabon 24/7\n');

  try {
    let email = await question('📧 Email admin [admin@gabon247.com]: ');
    email = email.trim() || 'admin@gabon247.com';

    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, email, is_admin')
      .eq('email', email);

    if (existingUsers && existingUsers.length > 0) {
      console.log(`\n⚠️  L'utilisateur ${email} existe déjà`);
      const update = await question('Promouvoir en admin? [O/n]: ');

      if (update.toLowerCase() !== 'n') {
        await supabase.from('users').update({ is_admin: true }).eq('email', email);
        console.log(`✅ ${email} est maintenant admin!`);
      }
      rl.close();
      return;
    }

    let password = await question('🔑 Mot de passe [générer auto]: ');
    if (!password.trim()) {
      password = generatePassword();
      console.log(`   Mot de passe généré: ${password}`);
    }

    const fullName = await question('👤 Nom complet [Administrateur Gabon 247]: ');

    console.log('\n⏳ Création en cours...\n');

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName || 'Administrateur Gabon 247', is_admin: true }
    });

    if (authError) {
      console.error('❌ Erreur création Auth:', authError.message);
      process.exit(1);
    }

    console.log('✅ Utilisateur créé dans Supabase Auth');

    await supabase.from('users').insert({
      id: authData.user.id,
      email: email,
      full_name: fullName || 'Administrateur Gabon 247',
      is_admin: true,
      subscription_type: 'admin',
      subscription_status: 'active',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    console.log('✅ Entrée créée dans table users (is_admin: true)');

    await supabase.from('user_credits').insert({
      user_id: authData.user.id,
      balance: 1000,
      bonus_balance: 100,
      updated_at: new Date().toISOString()
    });

    console.log('✅ Crédits initialisés (1000 + 100 bonus)');

    console.log('\n' + '='.repeat(50));
    console.log('🎉 ADMIN CRÉÉ AVEC SUCCÈS!');
    console.log('='.repeat(50));
    console.log(`\n📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🆔 User ID: ${authData.user.id}`);
    console.log(`💎 Crédits: 1100 (1000 + 100 bonus)`);

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('  🔐 GABON 24/7 - CRÉATION ADMINISTRATEUR');
  console.log('='.repeat(60));
  await createAdmin();
})();
