/**
 * 🔑 Script d'insertion de clé PVIT test
 *
 * Ce script insère une clé PVIT test dans la base de données.
 * Utilisez-le pour configurer l'environnement de test ou lorsque
 * la régénération automatique échoue.
 *
 * Usage: node scripts/insert-pvit-test-key.js [SECRET_KEY]
 *
 * Si aucune clé n'est fournie, utilise la clé test par défaut.
 */

require('dotenv').config();
const { supabase } = require('../config/supabase');

// Clé test par défaut fournie par le client
const DEFAULT_TEST_KEY = 'sk_test_a8777cd7-6a1a-40e7-851b-fe2ee3cfd3a8';

async function insertPvitTestKey(secretKey) {
  const operationAccountCode = process.env.PVIT_OPERATION_ACCOUNT_CODE;

  if (!operationAccountCode) {
    console.error('❌ PVIT_OPERATION_ACCOUNT_CODE non défini dans les variables d\'environnement');
    console.log('💡 Assurez-vous d\'avoir configuré cette variable sur Railway ou dans .env');
    process.exit(1);
  }

  console.log(`\n🔑 Insertion de la clé PVIT test`);
  console.log(`📍 Account Code: ${operationAccountCode}`);
  console.log(`🔐 Secret Key: ${secretKey.substring(0, 15)}...`);

  try {
    // 1. Désactiver les anciennes clés pour ce compte
    const { error: updateError } = await supabase
      .from('pvit_current_key')
      .update({ is_valid: false })
      .eq('operation_account_code', operationAccountCode);

    if (updateError) {
      console.warn('⚠️ Erreur lors de la désactivation des anciennes clés:', updateError.message);
      // Continuer quand même
    } else {
      console.log('✅ Anciennes clés désactivées');
    }

    // 2. Calculer la date d'expiration (7 jours pour les clés test)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 3. Insérer la nouvelle clé
    const { data, error: insertError } = await supabase
      .from('pvit_current_key')
      .insert({
        operation_account_code: operationAccountCode,
        secret_key: secretKey,
        expires_at: expiresAt.toISOString(),
        key_source: 'manual_test',
        is_valid: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur lors de l\'insertion:', insertError.message);

      // Si c'est une erreur de contrainte unique, essayer avec upsert
      if (insertError.code === '23505') {
        console.log('🔄 Tentative de mise à jour au lieu d\'insertion...');

        const { data: upsertData, error: upsertError } = await supabase
          .from('pvit_current_key')
          .upsert({
            operation_account_code: operationAccountCode,
            secret_key: secretKey,
            expires_at: expiresAt.toISOString(),
            key_source: 'manual_test',
            is_valid: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'operation_account_code',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (upsertError) {
          console.error('❌ Erreur lors de l\'upsert:', upsertError.message);
          process.exit(1);
        }

        console.log('✅ Clé mise à jour avec succès!');
        console.log(`📅 Expire le: ${expiresAt.toLocaleDateString('fr-FR')} à ${expiresAt.toLocaleTimeString('fr-FR')}`);
        return;
      }

      process.exit(1);
    }

    console.log('\n✅ Clé PVIT test insérée avec succès!');
    console.log(`📅 Expire le: ${expiresAt.toLocaleDateString('fr-FR')} à ${expiresAt.toLocaleTimeString('fr-FR')}`);
    console.log(`🆔 ID: ${data.id}`);

    // 4. Vérifier que la clé est accessible
    const { data: verifyData, error: verifyError } = await supabase
      .from('pvit_current_key')
      .select('*')
      .eq('operation_account_code', operationAccountCode)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (verifyError || !verifyData) {
      console.warn('⚠️ La clé a été insérée mais n\'est pas accessible. Vérifiez les RLS policies.');
    } else {
      console.log('✅ Vérification: La clé est accessible et valide');
    }

    console.log('\n🎉 Configuration PVIT terminée! Vous pouvez maintenant tester les paiements.');

  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
    process.exit(1);
  }
}

// Exécution
const secretKey = process.argv[2] || DEFAULT_TEST_KEY;
insertPvitTestKey(secretKey)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur fatale:', err);
    process.exit(1);
  });
