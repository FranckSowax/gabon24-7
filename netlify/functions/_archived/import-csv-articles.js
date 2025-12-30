const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const csv = require('csv-parser')
const path = require('path')

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Variables d\'environnement Supabase manquantes')
}

const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Gestion CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: 'Méthode non autorisée' 
      })
    }
  }

  try {
    console.log('🚀 Début de l\'importation des articles CSV')
    
    // Chemin vers le fichier CSV
    const csvPath = path.join(process.cwd(), 'documentations', 'GBI - Feuille 1.csv')
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ Fichier CSV non trouvé:', csvPath)
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          success: false, 
          error: 'Fichier CSV non trouvé' 
        })
      }
    }

    const articles = []
    
    // Lecture et parsing du CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv({
          separator: ',',
          headers: ['date_article', 'id_article', 'media', 'titre', 'secteur_activite', 'resume', 'url', 'statut', 'article_html', 'idees_business', 'extra']
        }))
        .on('data', (row) => {
          // Ignorer la ligne d'en-tête
          if (row.date_article === 'DATE ARTICLE ') return
          
          // Parser la date
          let publishedDate
          try {
            // Format: 26-02-2025 02:35
            const [datePart, timePart] = row.date_article.split(' ')
            const [day, month, year] = datePart.split('-')
            const dateStr = `${year}-${month}-${day}T${timePart || '00:00'}:00.000Z`
            publishedDate = new Date(dateStr)
            
            // Vérifier si la date est valide
            if (isNaN(publishedDate.getTime())) {
              publishedDate = new Date()
            }
          } catch (error) {
            console.warn('⚠️ Erreur parsing date:', row.date_article)
            publishedDate = new Date()
          }

          // Créer l'objet article dans le format Supabase
          const article = {
            id: `csv-${row.id_article}`,
            title: row.titre || 'Sans titre',
            summary: row.resume || 'Résumé non disponible',
            content: row.article_html || row.resume || 'Contenu non disponible',
            url: row.url || '',
            source: row.media || 'Source inconnue',
            author: row.media || 'Auteur inconnu',
            published_at: publishedDate.toISOString(),
            created_at: new Date().toISOString(),
            category: 'Business Intelligence',
            view_count: 0,
            trending: false,
            sentiment: 'neutre',
            keywords: row.secteur_activite ? row.secteur_activite.split(',').map(k => k.trim().toLowerCase()) : [],
            read_time: Math.max(1, Math.ceil((row.resume || '').length / 200)) + ' min'
          }

          articles.push(article)
        })
        .on('end', resolve)
        .on('error', reject)
    })

    console.log(`📊 ${articles.length} articles trouvés dans le CSV`)

    // Importer les articles par batch pour éviter les timeouts
    const batchSize = 50
    let importedCount = 0
    let errors = []

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize)
      
      try {
        const { data, error } = await supabase
          .from('articles')
          .upsert(batch, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (error) {
          console.error(`❌ Erreur batch ${Math.floor(i/batchSize) + 1}:`, error)
          errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`)
        } else {
          importedCount += batch.length
          console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} importé: ${batch.length} articles`)
        }
      } catch (batchError) {
        console.error(`❌ Erreur lors de l'importation du batch:`, batchError)
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${batchError.message}`)
      }
    }

    console.log(`🎉 Importation terminée: ${importedCount}/${articles.length} articles importés`)

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: `Importation réussie`,
        stats: {
          totalArticles: articles.length,
          importedCount: importedCount,
          errorCount: errors.length,
          errors: errors.slice(0, 5) // Limiter les erreurs affichées
        }
      })
    }

  } catch (error) {
    console.error('❌ Erreur lors de l\'importation:', error)
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de l\'importation des articles',
        details: error.message
      })
    }
  }
}
