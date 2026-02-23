#!/usr/bin/env node

/**
 * Script pour enrichir les articles récents avec TL;DR (résumé en 3 points)
 * Cible: Articles des dernières 24h sans tldr_points
 */

require('dotenv').config();
const supabaseService = require('./supabase-config');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: 'https://api.moonshot.ai/v1',
});

/**
 * Générer TL;DR pour un article
 */
async function generateTLDR(title, content) {
  try {
    const text = `${title}\n\n${content || ''}`.substring(0, 3000);

    const response = await openai.chat.completions.create({
      model: 'kimi-k2.5-preview',
      messages: [
        {
          role: 'system',
          content: `Tu es un journaliste expert. Génère exactement 3 points clés pour résumer cet article.
Chaque point doit:
- Être une phrase courte (max 20 mots)
- Commencer par un verbe d'action au présent
- Contenir l'information essentielle (QUI, QUOI, QUAND, OÙ)
- Être factuel et objectif

Réponds UNIQUEMENT avec un JSON: {"points": ["Point 1", "Point 2", "Point 3"]}`
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    });

    const result = response.choices[0]?.message?.content || '';
    
    // Parser le JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.points && Array.isArray(parsed.points) && parsed.points.length === 3) {
        return parsed.points;
      }
    }

    return null;
  } catch (error) {
    console.error(`❌ Erreur génération TL;DR:`, error.message);
    return null;
  }
}

/**
 * Script principal
 */
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('📝 ENRICHISSEMENT TL;DR - ARTICLES RÉCENTS');
  console.log('═'.repeat(60));
  console.log(`⏰ ${new Date().toLocaleString('fr-FR')}\n`);

  if (!process.env.KIMI_API_KEY) {
    console.error('❌ KIMI_API_KEY manquant dans .env');
    process.exit(1);
  }

  // Récupérer les articles des dernières 24h sans TL;DR
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  console.log(`📅 Recherche articles depuis: ${new Date(twentyFourHoursAgo).toLocaleString('fr-FR')}`);

  const { data: articles, error } = await supabaseService.supabase
    .from('articles')
    .select('id, title, summary, content, tldr_points, created_at')
    .gte('created_at', twentyFourHoursAgo)
    .is('tldr_points', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Erreur récupération articles:', error.message);
    process.exit(1);
  }

  console.log(`\n📊 Articles trouvés: ${articles?.length || 0}`);

  if (!articles || articles.length === 0) {
    console.log('✅ Tous les articles récents ont déjà un TL;DR!');
    return;
  }

  // Traiter chaque article
  let success = 0;
  let failed = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const progress = `[${i + 1}/${articles.length}]`;
    
    console.log(`\n${progress} 📄 ${article.title.substring(0, 60)}...`);

    const content = article.summary || article.content || '';
    const tldrPoints = await generateTLDR(article.title, content);

    if (tldrPoints) {
      // Sauvegarder dans Supabase
      const { error: updateError } = await supabaseService.supabase
        .from('articles')
        .update({ tldr_points: tldrPoints })
        .eq('id', article.id);

      if (updateError) {
        console.log(`   ❌ Erreur sauvegarde: ${updateError.message}`);
        failed++;
      } else {
        console.log(`   ✅ TL;DR généré:`);
        tldrPoints.forEach((point, idx) => {
          console.log(`      ${idx + 1}. ${point.substring(0, 70)}...`);
        });
        success++;
      }
    } else {
      console.log(`   ⚠️ Échec génération TL;DR`);
      failed++;
    }

    // Pause pour éviter rate limiting
    if (i < articles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Résumé
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`✅ Succès: ${success}`);
  console.log(`❌ Échecs: ${failed}`);
  console.log(`📝 Total: ${articles.length}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
