const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Rate limits OpenAI GPT-3.5-turbo (Tier 1)
const RATE_LIMITS = {
  MAX_REQUESTS_PER_MINUTE: 3500,
  MAX_TOKENS_PER_MINUTE: 160000,
  BATCH_SIZE: 20, // Articles traités par lot
  DELAY_BETWEEN_REQUESTS: 2000 // 2s entre les requêtes
};

// Fonction pour générer un résumé IA avec gestion d'erreur robuste
async function generateAISummary(title, content, retryCount = 0) {
  if (!openaiApiKey || !content) return null;
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Résume cet article en français en 2-3 phrases maximum, en restant factuel et informatif:\n\nTitre: ${title}\n\nContenu: ${content.substring(0, 1000)}`
        }],
        max_tokens: 150,
        temperature: 0.3
      })
    });
    
    if (response.status === 429) {
      // Rate limit atteint
      const retryAfter = parseInt(response.headers.get('retry-after') || '60');
      console.warn(`⚠️ Rate limit OpenAI, attente ${retryAfter}s`);
      
      if (retryCount < 3) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return generateAISummary(title, content, retryCount + 1);
      }
      throw new Error('Rate limit dépassé après 3 tentatives');
    }
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || null;
    
  } catch (error) {
    console.error('Erreur génération résumé IA:', error);
    
    if (retryCount < 2 && !error.message.includes('Rate limit')) {
      console.log(`🔄 Retry ${retryCount + 1}/2 pour résumé IA`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return generateAISummary(title, content, retryCount + 1);
    }
    
    throw error;
  }
}

// Processeur principal des résumés IA
async function processAISummaries() {
  try {
    console.log('🤖 Processeur résumés IA démarré...');
    
    // Récupérer les articles en attente de résumé par priorité
    const { data: pendingItems, error: fetchError } = await supabase
      .from('pending_ai_summaries')
      .select(`
        id,
        article_id,
        priority,
        retry_count,
        articles!inner(
          id,
          title,
          content,
          summary
        )
      `)
      .eq('status', 'pending')
      .lt('retry_count', 3) // Maximum 3 tentatives
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(RATE_LIMITS.BATCH_SIZE);
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!pendingItems || pendingItems.length === 0) {
      console.log('📭 Aucun résumé IA en attente');
      return {
        success: true,
        processed: 0,
        message: 'Aucun article en attente de résumé'
      };
    }
    
    console.log(`🔄 ${pendingItems.length} résumés IA à traiter`);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const startTime = Date.now();
    
    // Traiter chaque article avec délai pour respecter les rate limits
    for (const item of pendingItems) {
      try {
        // Marquer comme en cours de traitement
        await supabase
          .from('pending_ai_summaries')
          .update({ 
            status: 'processing',
            processed_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        console.log(`🤖 Génération résumé pour: ${item.articles.title.substring(0, 50)}...`);
        
        // Générer le résumé IA
        const aiSummary = await generateAISummary(
          item.articles.title,
          item.articles.content || item.articles.summary
        );
        
        if (aiSummary) {
          // Mettre à jour l'article avec le résumé IA
          const { error: updateError } = await supabase
            .from('articles')
            .update({ ai_summary: aiSummary })
            .eq('id', item.article_id);
          
          if (updateError) {
            throw updateError;
          }
          
          // Marquer comme terminé
          await supabase
            .from('pending_ai_summaries')
            .update({ status: 'completed' })
            .eq('id', item.id);
          
          console.log(`✅ Résumé généré avec succès`);
          successCount++;
        } else {
          throw new Error('Résumé IA vide');
        }
        
      } catch (error) {
        console.error(`❌ Erreur résumé pour article ${item.article_id}:`, error);
        errorCount++;
        errors.push(`Article ${item.article_id}: ${error.message}`);
        
        // Incrémenter le compteur de retry
        const newRetryCount = item.retry_count + 1;
        const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';
        
        await supabase
          .from('pending_ai_summaries')
          .update({ 
            status: newStatus,
            retry_count: newRetryCount,
            error_message: error.message
          })
          .eq('id', item.id);
      }
      
      processedCount++;
      
      // Délai entre les requêtes pour respecter les rate limits
      if (processedCount < pendingItems.length) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.DELAY_BETWEEN_REQUESTS));
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Log des statistiques
    console.log(`📊 Traitement terminé: ${successCount}/${processedCount} succès en ${Math.round(duration/1000)}s`);
    
    // Enregistrer les statistiques
    try {
      await supabase
        .from('sync_logs')
        .insert({
          sync_type: 'ai_summary_processing',
          feeds_processed: 0,
          articles_extracted: successCount,
          success_count: successCount,
          error_count: errorCount,
          errors: errors,
          duration_ms: duration,
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      console.error('❌ Erreur log:', logError);
    }
    
    return {
      success: true,
      processed: processedCount,
      successful: successCount,
      failed: errorCount,
      duration: Math.round(duration / 1000),
      errors: errorCount > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('❌ Erreur processeur IA:', error);
    throw error;
  }
}

// Handler Netlify
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Vérifier si OpenAI est configuré
    if (!openaiApiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'OpenAI non configuré, résumés IA désactivés',
          processed: 0
        })
      };
    }
    
    const result = await processAISummaries();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Traitement IA terminé: ${result.successful}/${result.processed} résumés générés`,
        ...result,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur handler:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur traitement résumés IA',
        message: error.message
      })
    };
  }
};
