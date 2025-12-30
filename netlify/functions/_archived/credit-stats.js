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

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    let userId = queryParams.userId;
    
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      userId = userId || body.userId;
    }

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'User ID required' 
        })
      };
    }

    const statsType = queryParams.type || 'all';

    switch (statsType) {
      case 'balance':
        return await getUserBalance(userId, headers);
      case 'transactions':
        return await getUserTransactions(userId, headers);
      case 'usage':
        return await getUserUsageStats(userId, headers);
      case 'openai_logs':
        return await getOpenAILogs(userId, headers);
      default:
        return await getAllStats(userId, headers);
    }

  } catch (error) {
    console.error('Credit stats error:', error);
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

async function getUserBalance(userId, headers) {
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  // Si aucun enregistrement, retourner un solde par défaut (0) au lieu d'une erreur
  if (error && error?.code !== 'PGRST116') {
    // Erreur réelle côté DB
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }

  const row = data || { user_id: userId, balance: 0, bonus_balance: 0, low_balance_threshold: 10 };
  const totalBalance = (row.balance || 0) + (row.bonus_balance || 0);
  const isLowBalance = totalBalance <= (row.low_balance_threshold || 10);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      balance: {
        ...row,
        total_balance: totalBalance,
        is_low_balance: isLowBalance,
        xaf_value: totalBalance * 10
      }
    })
  };
}

async function getUserTransactions(userId, headers) {
  const limit = 50; // Limite par défaut
  
  const { data: transactions, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

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

  // Calculer les totaux
  const totals = transactions?.reduce((acc, tx) => {
    if (tx.type === 'consumption') {
      acc.totalSpent += Math.abs(tx.amount);
    } else if (tx.type === 'purchase' || tx.type === 'bonus') {
      acc.totalEarned += tx.amount;
    }
    return acc;
  }, { totalSpent: 0, totalEarned: 0 }) || { totalSpent: 0, totalEarned: 0 };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      transactions: transactions || [],
      totals,
      count: transactions?.length || 0
    })
  };
}

async function getUserUsageStats(userId, headers) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Récupérer les transactions des 30 derniers jours
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('type, amount, service_name, created_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  // Récupérer les stats de services
  const { data: serviceStats } = await supabase
    .from('service_consumption')
    .select('service_name, credits_required, description, total_uses');

  if (!transactions) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Could not fetch usage data' 
      })
    };
  }

  const stats = {
    last30Days: {
      totalSpent: 0,
      totalEarned: 0,
      byService: {},
      byDay: {},
      byType: {}
    },
    topServices: [],
    serviceDetails: serviceStats || []
  };

  transactions.forEach(tx => {
    // Par type
    stats.last30Days.byType[tx.type] = 
      (stats.last30Days.byType[tx.type] || 0) + Math.abs(tx.amount);

    if (tx.amount < 0) {
      stats.last30Days.totalSpent += Math.abs(tx.amount);
      if (tx.service_name) {
        stats.last30Days.byService[tx.service_name] = 
          (stats.last30Days.byService[tx.service_name] || 0) + Math.abs(tx.amount);
      }
    } else {
      stats.last30Days.totalEarned += tx.amount;
    }

    // Par jour
    const day = new Date(tx.created_at).toISOString().split('T')[0];
    stats.last30Days.byDay[day] = 
      (stats.last30Days.byDay[day] || 0) + (tx.amount < 0 ? Math.abs(tx.amount) : 0);
  });

  stats.topServices = Object.entries(stats.last30Days.byService)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([service, amount]) => ({ service, amount }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      stats
    })
  };
}

async function getOpenAILogs(userId, headers) {
  const { data: logs, error } = await supabase
    .from('openai_usage_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

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

  // Calculer les totaux
  const totals = logs?.reduce((acc, log) => {
    acc.totalTokens += log.total_tokens;
    acc.totalCostUSD += parseFloat(log.actual_cost_usd?.toString() || '0');
    acc.totalCostXAF += parseFloat(log.actual_cost_xaf?.toString() || '0');
    acc.totalCreditsCharged += log.credits_charged;
    acc.totalMargin += parseFloat(log.margin_xaf?.toString() || '0');
    
    // Par modèle
    acc.byModel[log.model] = (acc.byModel[log.model] || 0) + log.total_tokens;
    
    return acc;
  }, {
    totalTokens: 0,
    totalCostUSD: 0,
    totalCostXAF: 0,
    totalCreditsCharged: 0,
    totalMargin: 0,
    byModel: {}
  }) || {
    totalTokens: 0,
    totalCostUSD: 0,
    totalCostXAF: 0,
    totalCreditsCharged: 0,
    totalMargin: 0,
    byModel: {}
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      logs: logs || [],
      totals,
      count: logs?.length || 0
    })
  };
}

async function getAllStats(userId, headers) {
  try {
    // Récupérer toutes les données en parallèle
    const [balanceResult, transactionsResult, usageResult, logsResult] = await Promise.allSettled([
      getUserBalance(userId, headers),
      getUserTransactions(userId, headers),
      getUserUsageStats(userId, headers),
      getOpenAILogs(userId, headers)
    ]);

    const response = {
      success: true,
      balance: null,
      transactions: null,
      usage: null,
      openai_logs: null
    };

    if (balanceResult.status === 'fulfilled') {
      const balanceData = JSON.parse(balanceResult.value.body);
      response.balance = balanceData.success ? balanceData.balance : null;
    }

    if (transactionsResult.status === 'fulfilled') {
      const transactionsData = JSON.parse(transactionsResult.value.body);
      response.transactions = transactionsData.success ? transactionsData : null;
    }

    if (usageResult.status === 'fulfilled') {
      const usageData = JSON.parse(usageResult.value.body);
      response.usage = usageData.success ? usageData.stats : null;
    }

    if (logsResult.status === 'fulfilled') {
      const logsData = JSON.parse(logsResult.value.body);
      response.openai_logs = logsData.success ? logsData : null;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error fetching all stats:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Error fetching comprehensive stats'
      })
    };
  }
}
