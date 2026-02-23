/**
 * Script de test: envoie le dernier article sur la chaîne WhatsApp Gabon Insight
 * Usage: WHAPI_TOKEN=xxx WHAPI_CHANNEL_ID=xxx node test-whatsapp-send.js
 */
const supabaseService = require('./supabase-config');
const whapiService = require('./services/whapiService');

(async () => {
  try {
    // Récupérer le dernier article enrichi
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary_ai, url, image_urls, published_at')
      .not('summary_ai', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Erreur Supabase:', error);
      process.exit(1);
    }

    if (articles.length === 0) {
      console.log('Aucun article enrichi trouvé');
      process.exit(0);
    }

    const article = articles[0];
    console.log('Article trouvé:');
    console.log('  Titre:', article.title);
    console.log('  Image:', (article.image_urls && article.image_urls[0]) || 'Aucune');
    console.log('  Date:', article.published_at);
    console.log('');

    const channelId = process.env.WHAPI_CHANNEL_ID || '120363423900961994@newsletter';
    const frontendUrl = 'https://gabon24-7.netlify.app';

    console.log('Envoi sur la chaîne:', channelId);
    const result = await whapiService.sendChannelPost(channelId, article, frontendUrl);
    console.log('Envoi réussi:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Erreur:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    process.exit(1);
  }
})();
