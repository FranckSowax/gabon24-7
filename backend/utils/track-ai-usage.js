/**
 * 📊 AI Usage Tracking - Direct insert into credit_transactions
 * Tracks every AI call per user for dashboard analytics
 */

const supabaseService = require('../supabase-config');

/**
 * Track an AI usage event in credit_transactions
 * @param {Object} params
 * @param {string|null} params.userId - User ID (null for anonymous/system calls)
 * @param {string} params.serviceName - AI service name (e.g. 'actu-plus', 'analyze-opportunity')
 * @param {string} params.description - Human-readable description
 * @param {number} [params.creditsUsed=0] - Credits consumed
 * @param {Object} [params.usage] - OpenAI usage object { prompt_tokens, completion_tokens, total_tokens }
 * @param {string} [params.model='gpt-4.1-mini'] - AI model used
 * @param {Object} [params.metadata={}] - Extra metadata (article IDs, budget, etc.)
 */
async function trackAIUsage({ userId, serviceName, description, creditsUsed = 0, usage = {}, model = 'gpt-4.1-mini', metadata = {} }) {
  try {
    // Fetch current balance for balance_after (required NOT NULL column)
    let balanceAfter = 0;
    let bonusBalanceAfter = 0;
    if (userId) {
      const { data: credits } = await supabaseService.supabase
        .from('user_credits')
        .select('credits, bonus_credits')
        .eq('user_id', userId)
        .single();
      if (credits) {
        balanceAfter = credits.credits || 0;
        bonusBalanceAfter = credits.bonus_credits || 0;
      }
    }

    const { error } = await supabaseService.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId || null,
        type: 'consumption',
        amount: -(creditsUsed || 0),
        balance_after: balanceAfter,
        bonus_balance_after: bonusBalanceAfter,
        description: description || `IA: ${serviceName}`,
        service_name: serviceName,
        status: 'completed',
        metadata: {
          model,
          tokens_prompt: usage.prompt_tokens || 0,
          tokens_completion: usage.completion_tokens || 0,
          tokens_total: usage.total_tokens || 0,
          ...metadata
        }
      });

    if (error) {
      console.warn(`⚠️ [AI-TRACKING] Insert failed for ${serviceName}:`, error.message);
    } else {
      console.log(`📊 [AI-TRACKING] ${serviceName} - user:${userId || 'anon'} - ${usage.total_tokens || 0} tokens`);
    }
  } catch (err) {
    // Non-blocking: never let tracking break the main flow
    console.warn(`⚠️ [AI-TRACKING] Error for ${serviceName}:`, err.message);
  }
}

module.exports = { trackAIUsage };
