/**
 * 💎 ROUTES CREDIT SYSTEM PREMIUM - Gabon 24/7
 * Gestion complète du système de crédits
 * Basé sur le document PDF fourni
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');

// ============================================
// 1. GET /api/credits/packages - Liste des packages
// ============================================
router.get('/packages', async (req, res) => {
  try {
    const { data: packages, error } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      packages: packages || []
    });

  } catch (error) {
    console.error('❌ Erreur récupération packages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 2. GET /api/credits/balance/:userId - Solde utilisateur
// ============================================
router.get('/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId manquant' });
    }

    const { data: userCredits, error } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    const balance = userCredits?.balance || 0;
    const bonusBalance = userCredits?.bonus_balance || 0;
    const totalBalance = balance + bonusBalance;

    res.json({
      success: true,
      balance,
      bonus_balance: bonusBalance,
      total_balance: totalBalance,
      is_low_balance: totalBalance < 10,
      total_earned: userCredits?.total_earned || 0,
      total_spent: userCredits?.total_spent || 0,
      last_purchase_at: userCredits?.last_purchase_at
    });

  } catch (error) {
    console.error('❌ Erreur récupération solde:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 3. POST /api/credits/consume - Consommer des crédits
// ============================================
router.post('/consume', async (req, res) => {
  try {
    const {
      userId,
      serviceName,
      amount,
      description,
      referenceId = null,
      metadata = {}
    } = req.body;

    if (!userId || !serviceName || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userId, serviceName et amount requis'
      });
    }

    // Appeler la fonction Postgres
    const { data, error } = await supabaseService.supabase
      .rpc('consume_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_service_name: serviceName,
        p_description: description || `Utilisation de ${serviceName}`,
        p_reference_id: referenceId,
        p_metadata: metadata
      });

    if (error) throw error;

    // data est un JSONB retourné par la fonction
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ ${amount} crédits consommés par ${userId} pour ${serviceName}`);

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur consommation crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 4. POST /api/credits/add - Ajouter des crédits (achat)
// ============================================
router.post('/add', async (req, res) => {
  try {
    const {
      userId,
      packageId,
      credits,
      bonusCredits = 0,
      pricePaidXaf,
      paymentMethod = 'admin',
      paymentReference = null,
      description = 'Achat de crédits'
    } = req.body;

    if (!userId || !credits || !pricePaidXaf) {
      return res.status(400).json({
        success: false,
        error: 'userId, credits et pricePaidXaf requis'
      });
    }

    // Appeler la fonction Postgres
    const { data, error } = await supabaseService.supabase
      .rpc('add_credits', {
        p_user_id: userId,
        p_credits: credits,
        p_bonus_credits: bonusCredits,
        p_package_id: packageId,
        p_price_paid_xaf: pricePaidXaf,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference,
        p_description: description
      });

    if (error) throw error;

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ ${credits + bonusCredits} crédits ajoutés à ${userId}`);

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur ajout crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 5. POST /api/credits/purchase - Acheter un package
// ============================================
router.post('/purchase', async (req, res) => {
  try {
    const {
      userId,
      packageId,
      paymentMethod = 'pending', // En attendant l'intégration Mobile Money
      paymentReference = null
    } = req.body;

    if (!userId || !packageId) {
      return res.status(400).json({
        success: false,
        error: 'userId et packageId requis'
      });
    }

    // Récupérer les détails du package
    const { data: package, error: pkgError } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();

    if (pkgError || !package) {
      return res.status(404).json({
        success: false,
        error: 'Package non trouvé ou inactif'
      });
    }

    // Pour l'instant, on simule un paiement réussi
    // TODO: Intégrer Mobile Money et Credit Card plus tard
    const { data, error } = await supabaseService.supabase
      .rpc('add_credits', {
        p_user_id: userId,
        p_credits: package.credits,
        p_bonus_credits: package.bonus_credits,
        p_package_id: packageId,
        p_price_paid_xaf: package.price_xaf,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference || `DEMO-${Date.now()}`,
        p_description: `Achat ${package.name}`
      });

    if (error) throw error;

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ Package ${package.name} acheté par ${userId}`);

    res.json({
      ...result,
      package: {
        name: package.name,
        credits: package.credits,
        bonus_credits: package.bonus_credits,
        price_xaf: package.price_xaf
      }
    });

  } catch (error) {
    console.error('❌ Erreur achat package:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 6. GET /api/credits/history/:userId - Historique des transactions
// ============================================
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, type = null } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId manquant' });
    }

    let query = supabaseService.supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Filtrer par type si spécifié
    if (type) {
      query = query.eq('type', type);
    }

    const { data: transactions, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      transactions: transactions || [],
      total: transactions?.length || 0
    });

  } catch (error) {
    console.error('❌ Erreur récupération historique:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 7. GET /api/credits/costs - Liste des coûts des services
// ============================================
router.get('/costs', async (req, res) => {
  try {
    const { data: costs, error } = await supabaseService.supabase
      .from('credit_costs')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) throw error;

    // Grouper par catégorie
    const grouped = {};
    costs.forEach(cost => {
      const category = cost.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(cost);
    });

    res.json({
      success: true,
      costs: costs || [],
      grouped
    });

  } catch (error) {
    console.error('❌ Erreur récupération coûts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 8. POST /api/credits/check - Vérifier si l'utilisateur a assez de crédits
// ============================================
router.post('/check', async (req, res) => {
  try {
    const { userId, serviceName, amount } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId manquant' });
    }

    // Récupérer le solde
    const { data: userCredits } = await supabaseService.supabase
      .from('user_credits')
      .select('balance, bonus_balance')
      .eq('user_id', userId)
      .single();

    const balance = userCredits?.balance || 0;
    const bonusBalance = userCredits?.bonus_balance || 0;
    const totalBalance = balance + bonusBalance;

    // Si amount n'est pas fourni, chercher le coût du service
    let requiredCredits = amount;
    if (!requiredCredits && serviceName) {
      const { data: cost } = await supabaseService.supabase
        .from('credit_costs')
        .select('cost_credits')
        .eq('service_name', serviceName)
        .eq('is_active', true)
        .single();

      requiredCredits = cost?.cost_credits || 0;
    }

    const hasEnough = totalBalance >= requiredCredits;

    res.json({
      success: true,
      has_enough: hasEnough,
      balance,
      bonus_balance: bonusBalance,
      total_balance: totalBalance,
      required: requiredCredits,
      missing: hasEnough ? 0 : requiredCredits - totalBalance
    });

  } catch (error) {
    console.error('❌ Erreur vérification crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 9. POST /api/credits/refund - Rembourser des crédits
// ============================================
router.post('/refund', async (req, res) => {
  try {
    const {
      userId,
      amount,
      description = 'Remboursement',
      referenceId = null
    } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'userId et amount requis'
      });
    }

    // Appeler la fonction Postgres
    const { data, error } = await supabaseService.supabase
      .rpc('refund_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId
      });

    if (error) throw error;

    const result = typeof data === 'string' ? JSON.parse(data) : data;

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`✅ ${amount} crédits remboursés à ${userId}`);

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur remboursement crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 9.5. POST /api/credits/purchase - Acheter des crédits
// ============================================
router.post('/purchase', async (req, res) => {
  try {
    const { userId, packageId, paymentMethod, paymentReference } = req.body;

    if (!userId || !packageId) {
      return res.status(400).json({
        success: false,
        error: 'userId et packageId requis'
      });
    }

    console.log(`💰 Demande d'achat package ${packageId} par ${userId}`);

    // 1. Récupérer les détails du package
    const { data: pkg, error: pkgError } = await supabaseService.supabase
      .from('credit_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (pkgError || !pkg) {
      return res.status(404).json({ success: false, error: 'Package introuvable' });
    }

    const creditsToAdd = pkg.credits;
    const bonusToAdd = pkg.bonus_credits || 0;
    const totalCredits = creditsToAdd + bonusToAdd;

    // 2. Exécuter la transaction d'achat
    // On essaie d'abord via RPC si disponible (plus sûr pour la concurrence)
    try {
      const { data, error } = await supabaseService.supabase
        .rpc('purchase_credits', {
          p_user_id: userId,
          p_package_id: packageId,
          p_credits: creditsToAdd,
          p_bonus: bonusToAdd,
          p_amount_paid: pkg.price_xaf,
          p_payment_method: paymentMethod || 'demo',
          p_payment_ref: paymentReference || `REF-${Date.now()}`
        });

      if (!error) {
        // RPC a réussi
        console.log('✅ Achat réussi via RPC');
        // Si la RPC retourne le nouveau solde directement (dépend de l'implémentation SQL)
        // Sinon on le récupère
        
        // Récupérer le solde à jour
        const { data: userCredits } = await supabaseService.supabase
          .from('user_credits')
          .select('balance, bonus_balance')
          .eq('user_id', userId)
          .single();

        return res.json({
          success: true,
          transaction_id: paymentReference,
          balance: userCredits?.balance || 0,
          bonus_balance: userCredits?.bonus_balance || 0,
          total_balance: (userCredits?.balance || 0) + (userCredits?.bonus_balance || 0),
          credits_added: totalCredits
        });
      }
    } catch (rpcError) {
      console.warn('⚠️ RPC purchase_credits non dispo ou erreur, passage en manuel:', rpcError.message);
    }

    // 3. Fallback Manuel (si RPC échoue ou n'existe pas)
    console.log('🔄 Exécution achat mode manuel...');
    
    // a. Récupérer solde actuel
    const { data: currentCredits } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    // Si pas de compte crédits, on le crée (ne devrait pas arriver si trigger à l'inscription)
    let currentBalance = 0;
    let currentBonus = 0;
    let totalSpent = 0;
    
    if (currentCredits) {
        currentBalance = currentCredits.balance;
        currentBonus = currentCredits.bonus_balance;
        totalSpent = currentCredits.total_spent;
    }

    // b. Mise à jour solde
    const newBalance = currentBalance + creditsToAdd;
    const newBonus = currentBonus + bonusToAdd;
    
    const { error: updateError } = await supabaseService.supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        balance: newBalance,
        bonus_balance: newBonus,
        total_earned: (currentCredits?.total_earned || 0) + totalCredits,
        last_purchase_at: new Date().toISOString()
      });
      
    if (updateError) throw updateError;

    // c. Enregistrer transaction
    await supabaseService.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'purchase',
        amount: totalCredits,
        description: `Achat ${pkg.name}`,
        service_name: 'credits_purchase',
        reference_id: paymentReference,
        metadata: {
            package_id: packageId,
            price: pkg.price_xaf,
            method: paymentMethod
        }
      });

    console.log(`✅ Achat réussi (Manuel): +${totalCredits} crédits pour ${userId}`);

    res.json({
      success: true,
      transaction_id: paymentReference,
      balance: newBalance,
      bonus_balance: newBonus,
      total_balance: newBalance + newBonus,
      credits_added: totalCredits
    });

  } catch (error) {
    console.error('❌ Erreur achat crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 10. GET /api/credits/stats/:userId - Statistiques utilisateur
// ============================================
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId manquant' });
    }

    // Récupérer le solde
    const { data: userCredits } = await supabaseService.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Récupérer les stats des transactions
    const { data: transactions } = await supabaseService.supabase
      .from('credit_transactions')
      .select('type, amount, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Calculer les stats
    const stats = {
      balance: userCredits?.balance || 0,
      bonus_balance: userCredits?.bonus_balance || 0,
      total_balance: (userCredits?.balance || 0) + (userCredits?.bonus_balance || 0),
      total_earned: userCredits?.total_earned || 0,
      total_spent: userCredits?.total_spent || 0,
      last_purchase_at: userCredits?.last_purchase_at,
      transactions_count: transactions?.length || 0,
      last_transaction: transactions?.[0] || null,
      monthly_spending: 0,
      most_used_service: null
    };

    // Calculer les dépenses du mois
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    stats.monthly_spending = transactions
      ?.filter(t => t.type === 'consume' && new Date(t.created_at) >= startOfMonth)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

    // Service le plus utilisé
    const serviceUsage = {};
    transactions
      ?.filter(t => t.type === 'consume')
      .forEach(t => {
        const service = t.service_name || 'unknown';
        serviceUsage[service] = (serviceUsage[service] || 0) + 1;
      });
    
    if (Object.keys(serviceUsage).length > 0) {
      stats.most_used_service = Object.entries(serviceUsage)
        .sort((a, b) => b[1] - a[1])[0][0];
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Erreur récupération stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 11. POST /api/credits/initialize - Initialiser un nouvel utilisateur
// ============================================
router.post('/initialize', async (req, res) => {
  try {
    const { userId, welcomeBonus = 50 } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId manquant' });
    }

    // Appeler la fonction Postgres
    const { error } = await supabaseService.supabase
      .rpc('initialize_user_credits', {
        p_user_id: userId,
        p_welcome_bonus: welcomeBonus
      });

    if (error) throw error;

    console.log(`✅ Compte crédits initialisé pour ${userId} avec ${welcomeBonus} crédits bonus`);

    res.json({
      success: true,
      message: 'Compte crédits initialisé',
      welcome_bonus: welcomeBonus
    });

  } catch (error) {
    console.error('❌ Erreur initialisation crédits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
