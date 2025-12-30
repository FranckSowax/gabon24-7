#!/usr/bin/env node
/**
 * 📺 Script: Extraction Journaux TV depuis RSS
 * Usage: node scripts/extract-youtube-journals.js
 * Cron: 0 star/6 * * * (toutes les 6 heures)
 */

const axios = require('axios');
const { DOMParser } = require('@xmldom/xmldom');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ykytsadwfqoyusleoflf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const RSS_URL = 'https://rss.app/feeds/8Zm0ezBRaaD2NiOF.xml';

async function extractJournals() {
  console.log('\n' + '='.repeat(80));
  console.log('📺 EXTRACTION JOURNAUX TV DEPUIS RSS');
  console.log('='.repeat(80));
  console.log(`🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' })} (WAT)`);
  console.log('');

  try {
    // 1. Récupérer le flux RSS via proxy CORS
    console.log('🔄 Récupération flux RSS...');
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(RSS_URL)}`;
    const response = await axios.get(proxyUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.data || !response.data.contents) {
      throw new Error('Pas de contenu RSS');
    }

    // 2. Parser le XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data.contents, 'text/xml');
    const items = xmlDoc.getElementsByTagName('item');

    console.log(`✅ ${items.length} vidéos trouvées dans le flux`);
    console.log('');

    // 3. Mots-clés pour identifier les journaux TV
    const journalKeywords = [
      'journal', 'jt', 'actualité', 'actualités', 'info', 'infos',
      'télé', 'tv', 'édition', 'flash', 'bulletin'
    ];

    const journals = [];

    // 4. Extraire les journaux (max 10 derniers)
    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i];

      const titleNode = item.getElementsByTagName('title')[0];
      const linkNode = item.getElementsByTagName('link')[0];
      const pubDateNode = item.getElementsByTagName('pubDate')[0];
      const enclosureNode = item.getElementsByTagName('enclosure')[0];
      const descriptionNode = item.getElementsByTagName('description')[0];

      const title = titleNode?.textContent || '';
      const link = linkNode?.textContent || '';
      const pubDate = pubDateNode?.textContent || '';
      const description = descriptionNode?.textContent || '';
      const thumbnail = enclosureNode?.getAttribute('url') || '';

      // Vérifier si c'est un journal TV
      const isJournal = journalKeywords.some(keyword =>
        title.toLowerCase().includes(keyword) ||
        description.toLowerCase().includes(keyword)
      );

      if (!isJournal) continue;

      // Extraire l'ID YouTube
      const videoId = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
      if (!videoId) continue;

      const journal = {
        video_id: videoId,
        title: title.trim(),
        thumbnail: thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        url: link,
        published_at: pubDate,
        channel_name: 'Gabon Télévision'
      };

      journals.push(journal);
    }

    console.log(`📊 ${journals.length} journaux TV détectés`);
    console.log('');

    if (journals.length === 0) {
      console.log('⚠️  Aucun journal trouvé');
      return;
    }

    // 5. Insérer dans Supabase (seulement les nouveaux)
    let inserted = 0;
    let skipped = 0;

    for (const journal of journals) {
      // Vérifier si existe déjà
      const { data: existing } = await supabase
        .from('youtube_cache')
        .select('video_id')
        .eq('video_id', journal.video_id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Insérer
      const { error } = await supabase
        .from('youtube_cache')
        .insert({
          ...journal,
          is_active: true,
          extracted_at: new Date().toISOString()
        });

      if (error) {
        console.error(`❌ Erreur insertion ${journal.video_id}:`, error.message);
      } else {
        inserted++;
        console.log(`✅ Nouveau: ${journal.title.substring(0, 60)}...`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('📊 RÉSUMÉ:');
    console.log(`   Total détecté: ${journals.length}`);
    console.log(`   ✅ Insérés: ${inserted}`);
    console.log(`   ⏭️  Ignorés (existants): ${skipped}`);
    console.log('='.repeat(80));

    // 6. Afficher le dernier journal
    if (inserted > 0) {
      const { data: latest } = await supabase
        .from('youtube_cache')
        .select('*')
        .eq('is_active', true)
        .order('extracted_at', { ascending: false })
        .limit(1)
        .single();

      if (latest) {
        console.log('');
        console.log('🎯 DERNIER JOURNAL DANS LA BASE:');
        console.log(`   📺 ${latest.title}`);
        console.log(`   🔗 ${latest.url}`);
        console.log(`   📅 ${new Date(latest.published_at).toLocaleDateString('fr-FR')}`);
        console.log('');
      }
    }

    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ ERREUR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
    }
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Exécuter
extractJournals();
