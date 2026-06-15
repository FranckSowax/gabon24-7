#!/usr/bin/env node
/**
 * 🚀 SYNCHRONISATION RSS RAPIDE (sans IA)
 * Version simplifiée pour ajouter rapidement des articles
 */

const RSSParser = require('rss-parser');
const crypto = require('crypto');
const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

const parser = new RSSParser({ timeout: 10000 });

async function quickSync() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   🚀 SYNCHRONISATION RSS RAPIDE (sans IA)        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    // 1. Récupérer flux actifs
    console.log('1️⃣ Récupération flux RSS actifs...');
    const { data: feeds, error } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('status', 'active')
      .limit(10); // Limiter à 10 pour test rapide

    if (error) throw error;
    console.log(`✅ ${feeds.length} flux trouvés\n`);

    let totalNew = 0;

    // 2. Traiter chaque flux
    for (const feed of feeds) {
      console.log(`📡 Traitement: ${feed.name}`);
      
      try {
        const rssFeed = await parser.parseURL(feed.url);
        console.log(`   📊 ${rssFeed.items.length} articles trouvés`);

        // Filtrer articles des dernières 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentItems = rssFeed.items.filter(item => {
          if (!item.pubDate && !item.isoDate) return true;
          const itemDate = new Date(item.pubDate || item.isoDate);
          return itemDate >= yesterday;
        });

        console.log(`   📅 ${recentItems.length} articles récents`);

        // Traiter chaque article
        for (const item of recentItems) {
          try {
            // Créer hash unique
            const url = item.link || item.guid || '';
            const hash = crypto.createHash('md5').update(url).digest('hex');

            // Vérifier si existe
            const { data: existing } = await supabase
              .from('articles')
              .select('id')
              .eq('content_hash', hash)
              .single();

            if (existing) continue; // Skip si existe

            // Créer article simplifié (sans IA)
            const article = {
              title: item.title || 'Sans titre',
              url: url,
              content_hash: hash,
              summary: item.contentSnippet || item.description || '',
              content: item.content || item.description || '',
              source: feed.name,
              category: feed.category || 'Actualités',
              published_at: item.pubDate || item.isoDate || new Date().toISOString(),
              is_published: true,
              read_time_minutes: Math.ceil((item.contentSnippet || '').length / 1000) || 3,
              view_count: 0,
              share_count: 0
            };

            // Insérer en BDD
            const { error: insertError } = await supabase
              .from('articles')
              .insert([article]);

            if (insertError) {
              if (insertError.code !== '23505') { // Ignore duplicates
                console.error(`   ⚠️ Erreur insert: ${insertError.message}`);
              }
            } else {
              totalNew++;
              console.log(`   ✅ Ajouté: ${item.title.substring(0, 50)}...`);
            }

          } catch (articleError) {
            console.error(`   ⚠️ Erreur article: ${articleError.message}`);
          }
        }

        // Pause entre flux
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (feedError) {
        console.error(`   ❌ Erreur flux: ${feedError.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ TERMINÉ: ${totalNew} nouveaux articles ajoutés`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

quickSync().then(() => process.exit(0));
