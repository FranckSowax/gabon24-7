/**
 * Script de correction des sources médias pour les articles existants
 * Applique le correctif sur tous les articles de la base de données
 */

const supabaseService = require('./supabase-config');
const sourceMediaCorrector = require('./services/source-media-corrector');

async function fixExistingSources() {
  console.log('\n🔧 CORRECTION DES SOURCES MÉDIAS EXISTANTES\n');
  console.log('📋 Règles appliquées:');
  const domains = sourceMediaCorrector.getSupportedDomains();
  Object.entries(domains).forEach(([domain, name]) => {
    console.log(`   • ${domain} → ${name}`);
  });
  console.log('   • Articles Facebook → Nom de l\'auteur\n');

  try {
    // 1. Récupérer tous les articles
    console.log('📡 Récupération des articles...');
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, url, source, author')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erreur récupération articles: ${error.message}`);
    }

    console.log(`✅ ${articles.length} articles récupérés\n`);

    // 2. Analyser et corriger
    let correctedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const corrections = [];

    console.log('🔍 Analyse et correction...\n');

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      if (!article.url) {
        skippedCount++;
        continue;
      }

      try {
        const correctedSource = sourceMediaCorrector.correctSource(
          article.url,
          article.source,
          article.author
        );

        // Vérifier si correction nécessaire
        if (correctedSource !== article.source) {
          corrections.push({
            id: article.id,
            oldSource: article.source || 'NULL',
            newSource: correctedSource,
            url: article.url
          });
          correctedCount++;

          // Afficher les 10 premières corrections
          if (correctedCount <= 10) {
            console.log(`[${correctedCount}] ${article.source || 'NULL'} → ${correctedSource}`);
            console.log(`    ${article.url.substring(0, 60)}...\n`);
          }
        } else {
          skippedCount++;
        }
      } catch (err) {
        console.error(`❌ Erreur article ${article.id}:`, err.message);
        errorCount++;
      }

      // Progress
      if ((i + 1) % 100 === 0) {
        console.log(`⏳ Progression: ${i + 1}/${articles.length} articles analysés...`);
      }
    }

    console.log('\n📊 ANALYSE TERMINÉE:');
    console.log(`   ✅ À corriger: ${correctedCount}`);
    console.log(`   ⏭️  Ignorés (déjà corrects): ${skippedCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}\n`);

    if (correctedCount === 0) {
      console.log('✅ Aucune correction nécessaire!\n');
      return;
    }

    // 3. Appliquer les corrections
    console.log('💾 APPLICATION DES CORRECTIONS...\n');

    let updateCount = 0;
    let updateErrors = 0;

    // Traiter par batch de 50
    const batchSize = 50;
    for (let i = 0; i < corrections.length; i += batchSize) {
      const batch = corrections.slice(i, i + batchSize);
      
      for (const correction of batch) {
        try {
          const { error: updateError } = await supabaseService.supabase
            .from('articles')
            .update({ source: correction.newSource })
            .eq('id', correction.id);

          if (updateError) {
            console.error(`❌ Erreur mise à jour ${correction.id}:`, updateError.message);
            updateErrors++;
          } else {
            updateCount++;
          }
        } catch (err) {
          console.error(`❌ Erreur:`, err.message);
          updateErrors++;
        }
      }

      console.log(`⏳ Mis à jour: ${Math.min(updateCount, corrections.length)}/${corrections.length}...`);
    }

    console.log('\n✅ CORRECTION TERMINÉE!\n');
    console.log('📊 RÉSULTAT:');
    console.log(`   ✅ Corrigés: ${updateCount}`);
    console.log(`   ❌ Erreurs: ${updateErrors}`);
    console.log(`   📈 Taux de succès: ${Math.round(updateCount / corrections.length * 100)}%\n`);

    // 4. Afficher un échantillon des corrections
    if (corrections.length > 0) {
      console.log('📝 ÉCHANTILLON DES CORRECTIONS:\n');
      const sample = corrections.slice(0, 20);
      
      // Grouper par ancienne source
      const grouped = {};
      sample.forEach(c => {
        if (!grouped[c.oldSource]) {
          grouped[c.oldSource] = [];
        }
        grouped[c.oldSource].push(c.newSource);
      });

      Object.entries(grouped).forEach(([oldSrc, newSources]) => {
        const uniqueNew = [...new Set(newSources)];
        console.log(`   "${oldSrc}" → ${uniqueNew.join(', ')}`);
      });
      console.log('');
    }

    // 5. Vérifier le résultat
    console.log('🔍 VÉRIFICATION POST-CORRECTION...\n');
    const { data: verifyData } = await supabaseService.supabase
      .from('articles')
      .select('source')
      .not('source', 'is', null);

    if (verifyData) {
      const sourceCounts = {};
      verifyData.forEach(a => {
        sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
      });

      console.log('📊 TOP 15 SOURCES MÉDIAS:\n');
      const sorted = Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

      sorted.forEach(([source, count], i) => {
        console.log(`   ${i + 1}. ${source}: ${count} articles`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le script
console.log('==========================================');
console.log('  CORRECTIF DES SOURCES MÉDIAS');
console.log('==========================================');

fixExistingSources().then(() => {
  console.log('==========================================');
  console.log('✅ SCRIPT TERMINÉ AVEC SUCCÈS');
  console.log('==========================================\n');
  process.exit(0);
});
