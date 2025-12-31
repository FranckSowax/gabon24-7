#!/usr/bin/env node
/**
 * Script de correction des sources Facebook
 * Remplace "Facebook" par le nom de la page officielle
 */

require('dotenv').config();
const supabaseService = require('../supabase-config');
const supabase = supabaseService.supabase;

// Mapping des pages Facebook vers les noms officiels
const facebookPageMapping = {
  'CommunicationGOUVGA': 'Communication Gouvernementale',
  'EsupGOUVGA': 'Enseignement Supérieur',
  'tvgabon24': 'Gabon 24',
  'gabon24': 'Gabon 24',
  'rtg1gabon': 'RTG1',
  'presidence.ga': 'Présidence de la République',
  'GouvernementGabonais': 'Gouvernement du Gabon',
  'ministeresantegabon': 'Ministère de la Santé',
  'MinistereInterieurGabon': 'Ministère de l\'Intérieur',
  'MinEconomieGabon': 'Ministère de l\'Économie',
  'MinFinancesGabon': 'Ministère des Finances',
  'PortParoleGouv': 'Porte-Parole du Gouvernement'
};

function extractFacebookPageName(url) {
  if (!url) return null;

  const patterns = [
    /facebook\.com\/([^\/\?]+)\/(?:posts|videos|reels?)/i,
    /facebook\.com\/([^\/\?]+)/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1] && match[1] !== 'reel' && match[1] !== 'watch' && match[1] !== 'groups') {
      const pageName = match[1];
      // Chercher dans le mapping
      if (facebookPageMapping[pageName]) {
        return facebookPageMapping[pageName];
      }
      // Sinon, formatter le nom de la page
      return pageName
        .replace(/GOUVGA$/i, ' (Gouvernement)')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .replace(/\s+/g, ' ');
    }
  }
  return null;
}

async function main() {
  console.log('🔧 Correction des sources Facebook\n');

  // Récupérer les articles avec source "Facebook"
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, url, source, title')
    .eq('source', 'Facebook');

  if (error) {
    console.error('Erreur:', error.message);
    return;
  }

  console.log(`📊 ${articles.length} articles avec source "Facebook" trouvés\n`);

  let updated = 0;
  let skipped = 0;

  for (const article of articles) {
    const newSource = extractFacebookPageName(article.url);

    if (newSource && newSource !== 'Facebook') {
      console.log(`✅ ${article.title?.substring(0, 50)}...`);
      console.log(`   Facebook -> ${newSource}\n`);

      const { error: updateError } = await supabase
        .from('articles')
        .update({ source: newSource })
        .eq('id', article.id);

      if (!updateError) {
        updated++;
      }
    } else {
      console.log(`⏭️  Skipped (reel/video sans page): ${article.url?.substring(0, 60)}...`);
      skipped++;
    }
  }

  console.log(`\n📈 Résultat: ${updated} mis à jour, ${skipped} ignorés`);
}

main().catch(console.error);
