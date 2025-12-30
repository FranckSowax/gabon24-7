const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const csv = require('csv-parser')
const path = require('path')

// Configuration Supabase - utiliser les variables d'environnement
const supabaseUrl = 'https://ykytsadwfqoyusleoflf.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMzMjk3MjYsImV4cCI6MjAzODkwNTcyNn0.pI0SNv0aLFHtPl7tnN-FUlYzQ-LCwMXN5s_MDLwF4d0'

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes')
  console.error('Assurez-vous que SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importCSVArticles() {
  try {
    console.log('🚀 Début de l\'importation des articles CSV vers Supabase')
    
    // Chemin vers le fichier CSV
    const csvPath = path.join(__dirname, '..', 'documentations', 'GBI - Feuille 1.csv')
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ Fichier CSV non trouvé:', csvPath)
      process.exit(1)
    }

    console.log('📁 Lecture du fichier CSV:', csvPath)
    const articles = []
    
    // Lecture et parsing du CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv({
          separator: ',',
          headers: ['date_article', 'id_article', 'media', 'titre', 'secteur_activite', 'resume', 'url', 'statut', 'article_html', 'idees_business', 'extra']
        }))
        .on('data', (row) => {
          // Ignorer la ligne d'en-tête et les lignes vides
          if (row.date_article === 'DATE ARTICLE ' || !row.date_article || !row.titre) return
          
          // Parser la date
          let publishedDate
          try {
            // Format: 26-02-2025 02:35
            const [datePart, timePart] = row.date_article.trim().split(' ')
            if (datePart) {
              const [day, month, year] = datePart.split('-')
              const dateStr = `${year}-${month}-${day}T${timePart || '00:00'}:00.000Z`
              publishedDate = new Date(dateStr)
              
              // Vérifier si la date est valide
              if (isNaN(publishedDate.getTime())) {
                publishedDate = new Date()
              }
            } else {
              publishedDate = new Date()
            }
          } catch (error) {
            console.warn('⚠️ Erreur parsing date:', row.date_article)
            publishedDate = new Date()
          }

          // Créer l'objet article dans le format Supabase
          const article = {
            id: `gbi-${row.id_article}`,
            title: (row.titre || 'Sans titre').substring(0, 500), // Limiter la longueur
            summary: (row.resume || 'Résumé non disponible').substring(0, 1000),
            content: `<div>${row.article_html || row.resume || 'Contenu non disponible'}</div>`,
            url: row.url || '',
            source: row.media || 'GBI Database',
            author: row.media || 'Business Intelligence',
            published_at: publishedDate.toISOString(),
            created_at: new Date().toISOString(),
            category: 'Business Intelligence',
            view_count: 0,
            trending: false,
            sentiment: 'neutre',
            keywords: row.secteur_activite ? 
              row.secteur_activite.split(',').map(k => k.trim().toLowerCase()).slice(0, 10) : 
              ['business', 'intelligence'],
            read_time: Math.max(1, Math.ceil((row.resume || '').length / 200)) + ' min'
          }

          articles.push(article)
        })
        .on('end', resolve)
        .on('error', reject)
    })

    console.log(`📊 ${articles.length} articles trouvés dans le CSV`)

    if (articles.length === 0) {
      console.log('⚠️ Aucun article valide trouvé dans le CSV')
      return
    }

    // Importer les articles par batch pour éviter les timeouts
    const batchSize = 100  // Augmenté pour plus d'efficacité
    let importedCount = 0
    let errors = []
    let skippedCount = 0

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize)
      
      try {
        console.log(`📤 Importation du batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(articles.length/batchSize)} (${batch.length} articles) - Progress: ${((i/articles.length)*100).toFixed(1)}%`)
        
        const { data, error } = await supabase
          .from('articles')
          .insert(batch)
          .select('id')

        if (error) {
          // Si erreur de duplication, continuer
          if (error.code === '23505') {
            console.log(`⚠️ Batch ${Math.floor(i/batchSize) + 1}: Articles déjà existants, ignorés`)
            skippedCount += batch.length
          } else {
            console.error(`❌ Erreur batch ${Math.floor(i/batchSize) + 1}:`, error.message)
            errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${error.message}`)
          }
        } else {
          importedCount += batch.length
          console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} importé avec succès: ${batch.length} articles`)
        }
      } catch (batchError) {
        console.error(`❌ Erreur lors de l'importation du batch:`, batchError.message)
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${batchError.message}`)
      }

      // Pause réduite entre les batches 
      if (i + batchSize < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    console.log('\n🎉 Importation terminée!')
    console.log(`📈 Statistiques:`)
    console.log(`   Total articles traités: ${articles.length}`)
    console.log(`   Articles importés: ${importedCount}`)
    console.log(`   Articles ignorés (doublons): ${skippedCount}`)
    console.log(`   Erreurs: ${errors.length}`)
    
    if (errors.length > 0) {
      console.log('\n❌ Erreurs rencontrées:')
      errors.forEach(error => console.log(`   - ${error}`))
    }

    // Vérifier le nombre total d'articles dans la base
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })

    console.log(`\n📊 Total d'articles dans Supabase: ${count}`)

  } catch (error) {
    console.error('❌ Erreur lors de l\'importation:', error.message)
    process.exit(1)
  }
}

// Exécuter l'importation
importCSVArticles()
