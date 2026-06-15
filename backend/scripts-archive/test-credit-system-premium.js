/**
 * 🧪 SCRIPT DE TEST - SYSTÈME DE CRÉDITS PREMIUM
 * Test complet du système de crédits
 */

require('dotenv').config();
const supabaseService = require('./supabase-config');

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'; // UUID de test

async function runTests() {
  console.log('\n🧪 === TEST SYSTÈME DE CRÉDITS PREMIUM ===\n');

  try {
    // ============================================
    // TEST 1: Vérifier les tables
    // ============================================
    console.log('1️⃣ Vérification des tables...\n');
    
    const tables = ['credit_packages', 'user_credits', 'credit_transactions', 'credit_costs', 'credit_promotions'];
    for (const table of tables) {
      const { data, error } = await supabaseService.supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`   ❌ Table ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ Table ${table}: OK`);
      }
    }

    // ============================================
    // TEST 2: Vérifier les packages
    // ============================================
    console.log('\n2️⃣ Vérification des packages...\n');
    
    const { data: packages, error: pkgError } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (pkgError) {
      console.error(`   ❌ Erreur: ${pkgError.message}`);
    } else {
      console.log(`   ✅ ${packages.length} packages trouvés:`);
      packages.forEach(pkg => {
        console.log(`      - ${pkg.name}: ${pkg.credits} + ${pkg.bonus_credits} bonus = ${pkg.credits + pkg.bonus_credits} crédits (${pkg.price_xaf} XAF)`);
      });
    }

    // ============================================
    // TEST 3: Vérifier les coûts des services
    // ============================================
    console.log('\n3️⃣ Vérification des coûts des services...\n');
    
    const { data: costs, error: costError } = await supabaseService.supabase
      .from('credit_costs')
      .select('*')
      .eq('is_active', true)
      .order('category');

    if (costError) {
      console.error(`   ❌ Erreur: ${costError.message}`);
    } else {
      console.log(`   ✅ ${costs.length} services configurés:`);
      
      const grouped = {};
      costs.forEach(cost => {
        const cat = cost.category || 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(cost);
      });

      Object.entries(grouped).forEach(([category, services]) => {
        console.log(`\n      📁 ${category.toUpperCase()}:`);
        services.forEach(s => {
          console.log(`         - ${s.display_name}: ${s.cost_credits} crédits`);
        });
      });
    }

    // ============================================
    // TEST 4: Initialiser un utilisateur de test
    // ============================================
    console.log('\n4️⃣ Initialisation utilisateur de test...\n');
    
    // Nettoyer d'abord
    await supabaseService.supabase
      .from('user_credits')
      .delete()
      .eq('user_id', TEST_USER_ID);

    await supabaseService.supabase
      .from('credit_transactions')
      .delete()
      .eq('user_id', TEST_USER_ID);

    // Initialiser
    const { error: initError } = await supabaseService.supabase
      .rpc('initialize_user_credits', {
        p_user_id: TEST_USER_ID,
        p_welcome_bonus: 50
      });

    if (initError) {
      console.error(`   ❌ Erreur: ${initError.message}`);
    } else {
      console.log(`   ✅ Utilisateur initialisé avec 50 crédits bonus`);
      
      // Vérifier le solde
      const { data: userCredits } = await supabaseService.supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', TEST_USER_ID)
        .single();

      console.log(`      Balance: ${userCredits.balance} crédits`);
      console.log(`      Bonus: ${userCredits.bonus_balance} crédits`);
      console.log(`      Total: ${userCredits.balance + userCredits.bonus_balance} crédits`);
    }

    // ============================================
    // TEST 5: Ajouter des crédits (achat)
    // ============================================
    console.log('\n5️⃣ Test ajout de crédits (achat)...\n');
    
    const { data: addResult, error: addError } = await supabaseService.supabase
      .rpc('add_credits', {
        p_user_id: TEST_USER_ID,
        p_credits: 100,
        p_bonus_credits: 20,
        p_package_id: null,
        p_price_paid_xaf: 5000,
        p_payment_method: 'test',
        p_payment_reference: 'TEST-' + Date.now(),
        p_description: 'Test achat de crédits'
      });

    if (addError) {
      console.error(`   ❌ Erreur: ${addError.message}`);
    } else {
      const result = typeof addResult === 'string' ? JSON.parse(addResult) : addResult;
      console.log(`   ✅ Crédits ajoutés:`);
      console.log(`      Balance: ${result.balance} crédits`);
      console.log(`      Bonus: ${result.bonus_balance} crédits`);
      console.log(`      Total: ${result.total_balance} crédits`);
    }

    // ============================================
    // TEST 6: Consommer des crédits
    // ============================================
    console.log('\n6️⃣ Test consommation de crédits...\n');
    
    const { data: consumeResult, error: consumeError } = await supabaseService.supabase
      .rpc('consume_credits', {
        p_user_id: TEST_USER_ID,
        p_amount: 10,
        p_service_name: 'ai_analysis',
        p_description: 'Test analyse IA',
        p_reference_id: 'test-article-123',
        p_metadata: { test: true }
      });

    if (consumeError) {
      console.error(`   ❌ Erreur: ${consumeError.message}`);
    } else {
      const result = typeof consumeResult === 'string' ? JSON.parse(consumeResult) : consumeResult;
      console.log(`   ✅ Crédits consommés:`);
      console.log(`      Consommé: ${result.consumed} crédits`);
      console.log(`      Depuis bonus: ${result.from_bonus} crédits`);
      console.log(`      Depuis balance: ${result.from_balance} crédits`);
      console.log(`      Balance restante: ${result.balance} crédits`);
      console.log(`      Bonus restant: ${result.bonus_balance} crédits`);
      console.log(`      Total restant: ${result.total_balance} crédits`);
    }

    // ============================================
    // TEST 7: Vérifier l'historique
    // ============================================
    console.log('\n7️⃣ Vérification de l\'historique...\n');
    
    const { data: transactions, error: txError } = await supabaseService.supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .order('created_at', { ascending: false });

    if (txError) {
      console.error(`   ❌ Erreur: ${txError.message}`);
    } else {
      console.log(`   ✅ ${transactions.length} transactions trouvées:\n`);
      transactions.forEach((tx, i) => {
        const sign = tx.amount >= 0 ? '+' : '';
        console.log(`      ${i + 1}. [${tx.type}] ${sign}${tx.amount} crédits - ${tx.description}`);
        console.log(`         Solde après: ${tx.balance_after} + ${tx.bonus_balance_after} bonus = ${tx.balance_after + tx.bonus_balance_after} total`);
        console.log(`         Date: ${new Date(tx.created_at).toLocaleString()}\n`);
      });
    }

    // ============================================
    // TEST 8: Test solde insuffisant
    // ============================================
    console.log('8️⃣ Test solde insuffisant...\n');
    
    const { data: failResult, error: failError } = await supabaseService.supabase
      .rpc('consume_credits', {
        p_user_id: TEST_USER_ID,
        p_amount: 1000, // Montant trop élevé
        p_service_name: 'test',
        p_description: 'Test échec',
        p_reference_id: null,
        p_metadata: {}
      });

    if (failError) {
      console.error(`   ❌ Erreur inattendue: ${failError.message}`);
    } else {
      const result = typeof failResult === 'string' ? JSON.parse(failResult) : failResult;
      if (!result.success) {
        console.log(`   ✅ Erreur correctement gérée:`);
        console.log(`      Message: ${result.error}`);
        console.log(`      Solde actuel: ${result.balance + result.bonus_balance} crédits`);
        console.log(`      Requis: ${result.required} crédits`);
      } else {
        console.error(`   ❌ L'erreur aurait dû être détectée`);
      }
    }

    // ============================================
    // TEST 9: Rembourser des crédits
    // ============================================
    console.log('\n9️⃣ Test remboursement de crédits...\n');
    
    const { data: refundResult, error: refundError } = await supabaseService.supabase
      .rpc('refund_credits', {
        p_user_id: TEST_USER_ID,
        p_amount: 5,
        p_description: 'Test remboursement',
        p_reference_id: 'test-refund-123'
      });

    if (refundError) {
      console.error(`   ❌ Erreur: ${refundError.message}`);
    } else {
      const result = typeof refundResult === 'string' ? JSON.parse(refundResult) : refundResult;
      console.log(`   ✅ Crédits remboursés:`);
      console.log(`      Remboursé: ${result.refunded} crédits`);
      console.log(`      Balance: ${result.balance} crédits`);
      console.log(`      Bonus: ${result.bonus_balance} crédits`);
      console.log(`      Total: ${result.total_balance} crédits`);
    }

    // ============================================
    // TEST 10: Statistiques finales
    // ============================================
    console.log('\n🔟 Statistiques finales...\n');
    
    const { data: finalCredits } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .single();

    const { data: finalTx } = await supabaseService.supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', TEST_USER_ID);

    console.log(`   📊 Solde final:`);
    console.log(`      Balance: ${finalCredits.balance} crédits`);
    console.log(`      Bonus: ${finalCredits.bonus_balance} crédits`);
    console.log(`      Total: ${finalCredits.balance + finalCredits.bonus_balance} crédits`);
    console.log(`\n   📈 Statistiques:`);
    console.log(`      Total gagné: ${finalCredits.total_earned} crédits`);
    console.log(`      Total dépensé: ${finalCredits.total_spent} crédits`);
    console.log(`      Transactions: ${finalTx.length}`);

    // ============================================
    // NETTOYAGE
    // ============================================
    console.log('\n🧹 Nettoyage des données de test...\n');
    
    await supabaseService.supabase
      .from('credit_transactions')
      .delete()
      .eq('user_id', TEST_USER_ID);

    await supabaseService.supabase
      .from('user_credits')
      .delete()
      .eq('user_id', TEST_USER_ID);

    console.log('   ✅ Données de test supprimées\n');

    console.log('✅ === TOUS LES TESTS RÉUSSIS ! ===\n');

  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter les tests
runTests().then(() => {
  console.log('🎉 Tests terminés avec succès!\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
