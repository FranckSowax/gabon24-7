const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration des crédits
const CREDIT_CONFIG = {
  CREDIT_TO_XAF: 10, // 1 crédit = 10 XAF
  XAF_TO_USD: 580,   // 1 USD = 580 XAF
  MARGIN_MULTIPLIER: 20,
  
  OPENAI_RATES: {
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-4': { input: 0.03, output: 0.06 }
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, userId, ...params } = JSON.parse(event.body || '{}');

    switch (action) {
      case 'check_balance':
        return await checkBalance(userId, params.requiredCredits, headers);
        
      case 'consume_credits':
        return await consumeCredits(userId, params, headers);
        
      case 'add_credits':
        return await addCredits(userId, params, headers);
        
      case 'get_user_stats':
        return await getUserStats(userId, headers);
        
      case 'init_user_credits':
        return await initUserCredits(userId, params, headers);
        
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
  } catch (error) {
    console.error('Credit manager error:', error);
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

async function checkBalance(userId, requiredCredits, headers) {
  const { data } = await supabase
    .from('user_credits')
    .select('balance, bonus_balance')
    .eq('user_id', userId)
    .single();
    
  if (!data) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: false, 
        hasCredits: false,
        balance: 0,
        required: requiredCredits
      })
    };
  }
  
  const totalCredits = data.balance + data.bonus_balance;
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      hasCredits: totalCredits >= requiredCredits,
      balance: totalCredits,
      required: requiredCredits
    })
  };
}

async function consumeCredits(userId, params, headers) {
  const { serviceName, amount, referenceId, openaiUsage } = params;
  
  const { data, error } = await supabase.rpc('consume_credits', {
    p_user_id: userId,
    p_service_name: serviceName,
    p_amount: amount,
    p_reference_id: referenceId
  });

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

  // Log OpenAI usage si fourni
  if (openaiUsage && data.transaction_id) {
    await logOpenAIUsage(userId, data.transaction_id, serviceName, openaiUsage);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      ...data
    })
  };
}

async function addCredits(userId, params, headers) {
  const { amount, type, description, expiresAt } = params;
  
  // Obtenir le solde actuel
  const { data: currentCredits } = await supabase
    .from('user_credits')
    .select('balance, bonus_balance')
    .eq('user_id', userId)
    .single();

  const currentBalance = currentCredits ? 
    currentCredits.balance + currentCredits.bonus_balance : 0;

  // Mettre à jour le solde
  const updateData = {
    user_id: userId,
    updated_at: new Date().toISOString()
  };

  if (type === 'bonus') {
    updateData.bonus_balance = (currentCredits?.bonus_balance || 0) + amount;
    updateData.balance = currentCredits?.balance || 0;
    if (expiresAt) updateData.bonus_expires_at = expiresAt;
  } else {
    updateData.balance = (currentCredits?.balance || 0) + amount;
    updateData.bonus_balance = currentCredits?.bonus_balance || 0;
  }

  const { error: updateError } = await supabase
    .from('user_credits')
    .upsert(updateData, {
      onConflict: 'user_id'
    });

  if (updateError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: updateError.message 
      })
    };
  }

  // Enregistrer la transaction
  await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type,
      amount,
      balance_before: currentBalance,
      balance_after: currentBalance + amount,
      description
    });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: `${amount} crédits ajoutés avec succès`
    })
  };
}

async function getUserStats(userId, headers) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('type, amount, service_name, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (!transactions) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false })
    };
  }

  const stats = {
    last30Days: {
      totalSpent: 0,
      totalEarned: 0,
      byService: {},
      byDay: {}
    },
    topServices: []
  };

  transactions.forEach(tx => {
    if (tx.amount < 0) {
      stats.last30Days.totalSpent += Math.abs(tx.amount);
      if (tx.service_name) {
        stats.last30Days.byService[tx.service_name] = 
          (stats.last30Days.byService[tx.service_name] || 0) + Math.abs(tx.amount);
      }
    } else {
      stats.last30Days.totalEarned += tx.amount;
    }

    const day = new Date(tx.created_at).toISOString().split('T')[0];
    stats.last30Days.byDay[day] = (stats.last30Days.byDay[day] || 0) + tx.amount;
  });

  stats.topServices = Object.entries(stats.last30Days.byService)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([service, amount]) => ({ service, amount }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, stats })
  };
}

async function initUserCredits(userId, params, headers) {
  const { initialCredits = 5 } = params; // 5 crédits gratuits par défaut
  
  const { error } = await supabase
    .from('user_credits')
    .upsert({
      user_id: userId,
      balance: initialCredits,
      bonus_balance: 0,
      lifetime_earned: initialCredits,
      monthly_allocation: 0
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: true
    });

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

  // Enregistrer la transaction d'initialisation
  await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type: 'bonus',
      amount: initialCredits,
      balance_before: 0,
      balance_after: initialCredits,
      description: 'Crédits de bienvenue'
    });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: `Compte initialisé avec ${initialCredits} crédits gratuits`
    })
  };
}

async function logOpenAIUsage(userId, transactionId, serviceName, usage) {
  const rate = CREDIT_CONFIG.OPENAI_RATES[usage.model] || CREDIT_CONFIG.OPENAI_RATES['gpt-4o-mini'];
  const actualCostUSD = (usage.prompt_tokens / 1000 * rate.input) + 
                       (usage.completion_tokens / 1000 * rate.output);
  const actualCostXAF = actualCostUSD * CREDIT_CONFIG.XAF_TO_USD;
  const creditsCharged = Math.ceil(usage.total_tokens / 1000 * CREDIT_CONFIG.CREDIT_TO_XAF);
  const marginXAF = (creditsCharged * CREDIT_CONFIG.CREDIT_TO_XAF) - actualCostXAF;

  await supabase
    .from('openai_usage_logs')
    .insert({
      user_id: userId,
      transaction_id: transactionId,
      model: usage.model,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      actual_cost_usd: actualCostUSD,
      actual_cost_xaf: actualCostXAF,
      credits_charged: creditsCharged,
      margin_xaf: marginXAF,
      service_name: serviceName
    });
}
