const { createClient } = require('@supabase/supabase-js');

// Fonction Netlify pour uploader et synchroniser le CSV GBI complet
exports.handler = async (event, context) => {
  // Configuration CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Configuration Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Configuration Supabase manquante' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parser le CSV depuis le body
    const csvData = JSON.parse(event.body);
    
    if (!csvData.records || !Array.isArray(csvData.records)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Format CSV invalide' })
      };
    }

    console.log(`📊 ${csvData.records.length} enregistrements CSV reçus`);

    // Vider la table CSV d'abord (optionnel - mettre en commentaire si on veut garder l'historique)
    if (csvData.clearTable) {
      console.log('🧹 Nettoyage de la table csv_articles_gbi...');
      const { error: deleteError } = await supabase
        .from('csv_articles_gbi')
        .delete()
        .neq('id', 0);
        
      if (deleteError && deleteError.code !== 'PGRST116') {
        console.log('Avertissement lors du nettoyage:', deleteError.message);
      }
    }

    // Importer les enregistrements par batches
    const batchSize = 100;
    let importedCount = 0;
    let errors = [];

    for (let i = 0; i < csvData.records.length; i += batchSize) {
      const batch = csvData.records.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('csv_articles_gbi')
          .insert(batch.map(record => ({
            date_article: record.date_article?.trim() || null,
            id_article: record.id_article?.trim() || null,
            media: record.media?.trim() || null,
            titre: record.titre?.trim().substring(0, 1000) || null,
            secteur_activite: record.secteur_activite?.trim() || null,
            resume: record.resume?.trim().substring(0, 2000) || null,
            url: record.url?.trim() || null,
            statut: record.statut?.trim() || null,
            article_html: record.article_html?.trim() || null,
            idees_business: record.idees_business?.trim() || null,
            perime: record.perime?.trim() || null
          })));
          
        if (error) {
          errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        } else {
          importedCount += batch.length;
        }
      } catch (batchError) {
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${batchError.message}`);
      }
    }

    console.log(`✅ ${importedCount} enregistrements importés dans csv_articles_gbi`);

    // Synchroniser vers la table articles
    console.log('🔄 Synchronisation vers la table articles...');
    const { data: syncResult, error: syncError } = await supabase
      .rpc('sync_csv_to_articles');
      
    if (syncError) {
      console.error('❌ Erreur de synchronisation:', syncError.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Erreur lors de la synchronisation',
          details: syncError.message,
          imported: importedCount,
          importErrors: errors
        })
      };
    }

    const result = syncResult[0] || { inserted_count: 0, updated_count: 0, error_count: 0 };

    console.log(`🎉 Synchronisation terminée: ${result.inserted_count} nouveaux, ${result.updated_count} mis à jour, ${result.error_count} erreurs`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Import et synchronisation terminés',
        csvImported: importedCount,
        articlesInserted: result.inserted_count,
        articlesUpdated: result.updated_count,
        syncErrors: result.error_count,
        importErrors: errors,
        totalArticlesInArchives: await getTotalArticlesCount(supabase)
      })
    };

  } catch (error) {
    console.error('❌ Erreur lors du traitement:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      })
    };
  }
};

// Fonction utilitaire pour compter les articles totaux
async function getTotalArticlesCount(supabase) {
  try {
    const { count, error } = await supabase
      .from('articles')
      .select('id', { count: 'exact' });
      
    return error ? null : count;
  } catch (error) {
    return null;
  }
}
