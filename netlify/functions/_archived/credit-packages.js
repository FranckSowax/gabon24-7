const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await getPackages(headers);
    } else if (event.httpMethod === 'POST') {
      const { action, ...params } = JSON.parse(event.body || '{}');
      
      switch (action) {
        case 'purchase':
          return await purchasePackage(params, headers);
        case 'get_user_packages':
          return await getUserPackages(params.userId, headers);
        default:
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              success: false, 
              error: 'Invalid action' 
            })
          };
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Credit packages error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
};

async function getPackages(headers) {
  const { data: packages, error } = await supabase
    .from('credit_packages')
    .select('*')
    .eq('is_active', true)
    .order('credits', { ascending: true });

  if (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      packages: packages || []
    })
  };
}

async function purchasePackage(params, headers) {
  const { userId, packageId, paymentReference, paymentMethod } = params;

  // Récupérer le package
  const { data: pkg, error: pkgError } = await supabase
    .from('credit_packages')
    .select('*')
    .eq('id', packageId)
    .eq('is_active', true)
    .single();

  if (pkgError || !pkg) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Package non trouvé ou inactif' 
      })
    };
  }

  // Vérifier les limites d'achat par utilisateur
  if (pkg.max_purchases_per_user) {
    const { count } = await supabase
      .from('credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'purchase')
      .contains('metadata', { package_id: packageId });

    if (count && count >= pkg.max_purchases_per_user) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Limite d\'achat atteinte pour ce package' 
        })
      };
    }
  }

  try {
    // Obtenir le solde actuel
    const { data: currentCredits } = await supabase
      .from('user_credits')
      .select('balance, bonus_balance')
      .eq('user_id', userId)
      .single();

    const currentBalance = currentCredits ? 
      currentCredits.balance + currentCredits.bonus_balance : 0;

    // Mettre à jour les crédits
    const { error: updateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        balance: (currentCredits?.balance || 0) + pkg.credits,
        bonus_balance: (currentCredits?.bonus_balance || 0) + pkg.bonus_credits,
        lifetime_earned: (currentCredits?.balance || 0) + pkg.credits + pkg.bonus_credits,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      throw updateError;
    }

    // Enregistrer la transaction d'achat
    const { data: transaction, error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'purchase',
        amount: pkg.credits + pkg.bonus_credits,
        balance_before: currentBalance,
        balance_after: currentBalance + pkg.credits + pkg.bonus_credits,
        payment_method: paymentMethod || 'unknown',
        payment_reference: paymentReference,
        amount_xaf: pkg.price_xaf,
        description: `Achat package ${pkg.name}`,
        metadata: {
          package_id: packageId,
          package_name: pkg.name,
          credits_purchased: pkg.credits,
          bonus_credits: pkg.bonus_credits
        }
      })
      .select()
      .single();

    if (txError) {
      throw txError;
    }

    // Si c'est un bonus, enregistrer séparément la transaction bonus
    if (pkg.bonus_credits > 0) {
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          type: 'bonus',
          amount: pkg.bonus_credits,
          balance_before: currentBalance + pkg.credits,
          balance_after: currentBalance + pkg.credits + pkg.bonus_credits,
          description: `Bonus package ${pkg.name}`,
          reference_id: transaction.id,
          metadata: {
            parent_purchase: transaction.id,
            package_id: packageId
          }
        });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        transaction_id: transaction.id,
        credits_added: pkg.credits + pkg.bonus_credits,
        new_balance: currentBalance + pkg.credits + pkg.bonus_credits,
        message: `Package ${pkg.name} acheté avec succès!`
      })
    };

  } catch (error) {
    console.error('Purchase error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de l\'achat du package'
      })
    };
  }
}

async function getUserPackages(userId, headers) {
  const { data: purchases, error } = await supabase
    .from('credit_transactions')
    .select('*, metadata')
    .eq('user_id', userId)
    .eq('type', 'purchase')
    .order('created_at', { ascending: false });

  if (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      purchases: purchases || []
    })
  };
}
