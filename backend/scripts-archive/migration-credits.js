/**
 * SCRIPT DE MIGRATION DES CRÉDITS
 * Transfère les crédits de user_credits vers users.credits_balance
 */

require('dotenv').config();
const supabaseService = require('./supabase-config');
const supabase = supabaseService.supabase;

async function migrateCredits() {
  console.log('\n🔄 DÉBUT DE LA MIGRATION DES CRÉDITS\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Vérifier la connexion Supabase
    console.log('\n✓ Connexion à Supabase...');
    
    // 2. Récupérer tous les user_credits
    console.log('✓ Récupération des crédits existants depuis user_credits...');
    const { data: userCredits, error: fetchError } = await supabase
      .from('user_credits')
      .select('user_id, balance, bonus_balance');
    
    if (fetchError) {
      console.error('❌ Erreur récupération user_credits:', fetchError);
      return;
    }
    
    if (!userCredits || userCredits.length === 0) {
      console.log('⚠️  Aucun crédit à migrer dans user_credits');
      return;
    }
    
    console.log(`\n📊 ${userCredits.length} utilisateur(s) trouvé(s) avec des crédits\n`);
    console.log('=' .repeat(60));
    
    // 3. Afficher un aperçu avant migration
    console.log('\n📋 APERÇU DES CRÉDITS À MIGRER:\n');
    let totalCreditsToMigrate = 0;
    userCredits.forEach((credit, index) => {
      const total = (credit.balance || 0) + (credit.bonus_balance || 0);
      totalCreditsToMigrate += total;
      if (index < 5) { // Afficher les 5 premiers
        console.log(`   User ${credit.user_id.substring(0, 8)}... : ${credit.balance || 0} + ${credit.bonus_balance || 0} = ${total} crédits`);
      }
    });
    if (userCredits.length > 5) {
      console.log(`   ... et ${userCredits.length - 5} autre(s)`);
    }
    console.log(`\n   💰 TOTAL À MIGRER: ${totalCreditsToMigrate} crédits\n`);
    console.log('=' .repeat(60));
    
    // 4. Migrer chaque utilisateur
    console.log('\n🚀 MIGRATION EN COURS...\n');
    let migrated = 0;
    let errors = 0;
    let skipped = 0;
    
    for (const credit of userCredits) {
      const total = (credit.balance || 0) + (credit.bonus_balance || 0);
      
      // Vérifier si l'utilisateur existe
      const { data: userExists } = await supabase
        .from('users')
        .select('id, credits_balance')
        .eq('id', credit.user_id)
        .single();
      
      if (!userExists) {
        console.log(`⚠️  Utilisateur ${credit.user_id.substring(0, 8)}... n'existe pas dans users, ignoré`);
        skipped++;
        continue;
      }
      
      // Migrer les crédits
      const { error: updateError } = await supabase
        .from('users')
        .update({ credits_balance: total })
        .eq('id', credit.user_id);
      
      if (updateError) {
        console.error(`❌ Erreur pour ${credit.user_id.substring(0, 8)}...: ${updateError.message}`);
        errors++;
      } else {
        migrated++;
        const oldBalance = userExists.credits_balance || 0;
        console.log(`✅ [${migrated}/${userCredits.length}] User ${credit.user_id.substring(0, 8)}... : ${oldBalance} → ${total} crédits`);
      }
    }
    
    // 5. Résumé de la migration
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 RÉSUMÉ DE LA MIGRATION:\n');
    console.log(`   ✅ Migrés avec succès: ${migrated}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   ⚠️  Ignorés: ${skipped}`);
    console.log(`   📋 Total traité: ${userCredits.length}`);
    
    // 6. Vérification post-migration
    console.log('\n🔍 VÉRIFICATION POST-MIGRATION...\n');
    const { data: verification, error: verifyError } = await supabase
      .from('users')
      .select('id, email, credits_balance')
      .gt('credits_balance', 0)
      .order('credits_balance', { ascending: false })
      .limit(10);
    
    if (!verifyError && verification) {
      console.log('📋 TOP 10 UTILISATEURS PAR CRÉDITS:\n');
      verification.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email?.substring(0, 20).padEnd(20, ' ')} : ${user.credits_balance} crédits`);
      });
      
      // Calculer le total
      const { data: stats } = await supabase
        .from('users')
        .select('credits_balance');
      
      if (stats) {
        const totalInSystem = stats.reduce((sum, u) => sum + (u.credits_balance || 0), 0);
        console.log(`\n   💰 TOTAL DES CRÉDITS DANS LE SYSTÈME: ${totalInSystem}\n`);
      }
    }
    
    console.log('=' .repeat(60));
    console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS !\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:', error);
    process.exit(1);
  }
}

// Exécuter la migration
console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║   MIGRATION DES CRÉDITS - user_credits → users.credits   ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

migrateCredits()
  .then(() => {
    console.log('\n👋 Script terminé. Vous pouvez fermer cette fenêtre.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });
