/**
 * Créer un résumé audio de test pour tester le générateur de sondages
 */

const supabaseService = require('./supabase-config');

async function createTestAudioSummary() {
  try {
    console.log('\n📝 CRÉATION D\'UN RÉSUMÉ AUDIO DE TEST');
    console.log('='.repeat(80));

    // Récupérer quelques articles récents
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error: articlesError } = await supabaseService.supabase
      .from('articles')
      .select('id, title, category')
      .gte('created_at', twentyFourHoursAgo)
      .limit(10);

    if (articlesError || !articles || articles.length === 0) {
      console.log('⚠️  Pas assez d\'articles récents, utilisation d\'articles plus anciens...');
      
      const { data: olderArticles } = await supabaseService.supabase
        .from('articles')
        .select('id, title, category')
        .order('created_at', { ascending: false })
        .limit(10);
      
      articles.splice(0, articles.length, ...(olderArticles || []));
    }

    console.log(`📰 ${articles.length} articles trouvés`);

    // Créer un résumé audio de test réaliste
    const testSummary = `Bonjour et bienvenue dans votre résumé de l'actualité gabonaise des dernières 24 heures.

Sur le plan politique, le gouvernement a annoncé de nouvelles mesures pour moderniser l'administration publique. Le Premier ministre a souligné l'importance de la digitalisation des services pour améliorer l'efficacité et réduire la bureaucratie. Cette initiative fait partie d'un programme plus large de réformes administratives visant à renforcer la gouvernance.

Du côté économique, plusieurs entreprises locales bénéficient d'un nouveau programme de soutien aux PME lancé par le ministère de l'Économie. L'objectif est de stimuler la création d'emplois et de favoriser la diversification économique du pays. Les experts s'accordent à dire que ces mesures pourraient avoir un impact positif sur la croissance économique à moyen terme.

Sur le plan social, les citoyens expriment des préoccupations concernant l'accès aux services de santé, notamment dans les zones rurales. Le ministère de la Santé a promis d'améliorer les infrastructures sanitaires et de renforcer le personnel médical dans les régions les plus touchées.

Enfin, dans le domaine de l'éducation, le gouvernement travaille sur une réforme du système éducatif pour mieux préparer les jeunes aux défis du marché du travail moderne.

Voilà pour ce tour d'horizon de l'actualité. Merci de votre écoute et à bientôt pour votre prochain résumé quotidien.`;

    // Insérer le résumé audio
    const { data: summary, error: insertError } = await supabaseService.supabase
      .from('audio_summaries')
      .insert({
        user_id: null, // Public
        summary_type: 'daily',
        article_ids: articles.map(a => a.id),
        articles_count: articles.length,
        text_summary: testSummary,
        status: 'completed',
        language: 'fr',
        time_slot: 'morning',
        whatsapp_sent: false,
        audio_url: null,
        audio_duration_seconds: 120
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('❌ Erreur insertion:', insertError.message);
      return null;
    }

    console.log('\n✅ Résumé audio de test créé !');
    console.log(`   ID: ${summary.id}`);
    console.log(`   Date: ${new Date(summary.created_at).toLocaleString('fr-FR')}`);
    console.log(`   Articles: ${articles.length}`);
    console.log(`   Texte: ${testSummary.length} caractères`);

    return summary;

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return null;
  }
}

// Exécuter
if (require.main === module) {
  createTestAudioSummary()
    .then((result) => {
      if (result) {
        console.log('\n✅ Prêt pour tester le générateur de sondages !');
        console.log('   Exécutez: node test-poll-generator.js\n');
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('❌', err);
      process.exit(1);
    });
}

module.exports = { createTestAudioSummary };
