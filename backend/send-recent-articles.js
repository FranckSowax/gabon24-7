/**
 * Envoie les articles enrichis des N dernières heures sur la chaîne WhatsApp
 * Usage: WHAPI_TOKEN=xxx OPENAI_API_KEY=xxx node send-recent-articles.js [heures]
 * Exemple: node send-recent-articles.js 3   (articles des 3 dernières heures)
 */
const supabaseService = require('./supabase-config');
const whapiService = require('./services/whapiService');

const hours = parseInt(process.argv[2]) || 3;
const DELAY_BETWEEN_POSTS = 8000; // 8 secondes entre chaque envoi

(async () => {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    console.log(`Recherche des articles enrichis depuis ${hours}h (${since})...\n`);

    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary_ai, summary, url, image_urls, published_at, whatsapp_sent')
      .or('summary_ai.not.is.null,summary.not.is.null')
      .gte('published_at', since)
      .order('published_at', { ascending: true });

    if (error) {
      console.error('Erreur Supabase:', error);
      process.exit(1);
    }

    if (!articles || articles.length === 0) {
      console.log('Aucun article enrichi trouvé sur cette période.');
      process.exit(0);
    }

    const notSent = articles.filter(a => !a.whatsapp_sent);
    const alreadySent = articles.length - notSent.length;

    console.log(`${articles.length} articles trouvés (${alreadySent} déjà envoyés, ${notSent.length} à envoyer)\n`);

    if (notSent.length === 0) {
      console.log('Tous les articles ont déjà été envoyés.');
      process.exit(0);
    }

    const channelId = process.env.WHAPI_CHANNEL_ID || '120363423900961994@newsletter';
    const frontendUrl = 'https://gabon24-7.netlify.app';
    let sent = 0;
    let errors = 0;

    for (const article of notSent) {
      try {
        console.log(`[${sent + 1}/${notSent.length}] ${article.title}`);
        console.log(`  Image: ${(article.image_urls && article.image_urls[0]) ? 'Oui' : 'Non'}`);
        console.log(`  Date:  ${article.published_at}`);

        const result = await whapiService.sendChannelPost(channelId, article, frontendUrl);
        console.log(`  ✅ Envoyé (${result.type})`);

        // Marquer comme envoyé
        await supabaseService.supabase
          .from('articles')
          .update({ whatsapp_sent: true })
          .eq('id', article.id);

        sent++;

        // Pause entre les envois
        if (sent < notSent.length) {
          console.log(`  ⏳ Pause ${DELAY_BETWEEN_POSTS / 1000}s...\n`);
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_POSTS));
        }
      } catch (err) {
        console.error(`  ❌ Erreur: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
        errors++;
      }
    }

    console.log(`\n=== RÉSULTAT ===`);
    console.log(`Envoyés: ${sent}/${notSent.length}`);
    console.log(`Erreurs: ${errors}`);
    console.log(`Déjà envoyés: ${alreadySent}`);
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  }
})();
