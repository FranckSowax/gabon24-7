/**
 * Test de génération multilingue (FR, EN, ZH)
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001';

async function testMultilingualGeneration() {
  console.log('🌍 Test génération résumés multilingues\n');
  
  try {
    console.log('1️⃣  Génération manuelle des 3 langues...\n');
    
    const languages = ['fr', 'en', 'zh'];
    const summaryIds = [];
    
    for (const lang of languages) {
      const langLabel = { fr: '🇫🇷 Français', en: '🇺🇸 English', zh: '🇨🇳 中文' }[lang];
      console.log(`   Génération ${langLabel}...`);
      
      // Générer avec language spécifique
      const res = await fetch(`${API_URL}/api/audio/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'daily',
          userId: null, // Public
          language: lang,
          pace: 'normal',
          optimize: true,
          sendWhatsApp: false
        })
      });

      const data = await res.json();
      
      if (data.success) {
        console.log(`   ✅ ${langLabel}: ${data.summaryId}`);
        summaryIds.push({ lang, id: data.summaryId });
      } else {
        console.log(`   ❌ Erreur ${langLabel}:`, data.error);
      }
      
      // Pause entre générations
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n✅ ${summaryIds.length} résumé(s) créé(s)`);
    console.log('   Traitement en arrière-plan...\n');

    // Attendre un peu
    console.log('⏳ Attente de 10 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Vérifier les résumés multilingues
    console.log('2️⃣  Récupération des derniers résumés par langue...\n');
    
    for (const lang of languages) {
      const langLabel = { fr: '🇫🇷 Français', en: '🇺🇸 English', zh: '🇨🇳 中文' }[lang];
      
      const res = await fetch(`${API_URL}/api/audio/latest-public?language=${lang}`);
      const data = await res.json();
      
      if (data.success && data.summary) {
        const s = data.summary;
        console.log(`   ${langLabel}:`);
        console.log(`      ID: ${s.id}`);
        console.log(`      Statut: ${s.status}`);
        console.log(`      Articles: ${s.articles_count}`);
        if (s.text_summary) {
          console.log(`      Script: ${s.text_summary.substring(0, 80)}...`);
        }
        if (s.audio_url) {
          console.log(`      Audio: ✅ Disponible`);
        }
        console.log('');
      } else {
        console.log(`   ${langLabel}: Aucun résumé trouvé\n`);
      }
    }

    // Test endpoint multilingue
    console.log('3️⃣  Test endpoint /api/audio/latest-multilingual...\n');
    
    const multiRes = await fetch(`${API_URL}/api/audio/latest-multilingual`);
    const multiData = await multiRes.json();
    
    if (multiData.success) {
      console.log(`   ✅ ${multiData.count} langue(s) disponible(s):`);
      
      Object.entries(multiData.summaries).forEach(([lang, summary]) => {
        const langLabel = { fr: '🇫🇷 Français', en: '🇺🇸 English', zh: '🇨🇳 中文' }[lang];
        console.log(`      ${langLabel}: ${summary.time_slot || 'N/A'} - ${summary.status}`);
      });
    }

    console.log('\n✅ Tests terminés !');
    console.log('\n📝 Points à vérifier:');
    console.log('   1. Les 3 résumés sont générés automatiquement à 7h, 13h et 20h');
    console.log('   2. Chaque créneau génère FR, EN et ZH en parallèle');
    console.log('   3. Total: 9 résumés/jour (3 créneaux × 3 langues)');
    console.log('   4. Widget frontend permet de changer de langue');
    console.log('   5. API filtre par langue avec paramètre ?language=fr/en/zh');
    
    console.log('\n💰 Coûts estimés:');
    console.log('   - 9 résumés/jour × $0.00052 = $0.00468/jour');
    console.log('   - $0.14/mois (vs $432 sans automatisation pour 1000 users)');
    console.log('   - Économie: 99.97% 🎉');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur test:', error);
    process.exit(1);
  }
}

// Vérifier configuration
console.log('🔍 Vérification configuration:\n');

const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasReplicate = !!process.env.REPLICATE_API_TOKEN;

console.log(`   OPENAI_API_KEY: ${hasOpenAI ? '✅' : '❌ manquant'}`);
console.log(`   REPLICATE_API_TOKEN: ${hasReplicate ? '✅' : '❌ manquant'}\n`);

if (!hasOpenAI) {
  console.log('⚠️  Sans OPENAI_API_KEY:');
  console.log('   - Résumés basiques seront générés (top 3 articles)');
  console.log('   - Pas d\'analyse IA politique intelligente\n');
}

if (!hasReplicate) {
  console.log('⚠️  Sans REPLICATE_API_TOKEN:');
  console.log('   - Seuls les scripts texte seront générés');
  console.log('   - Pas d\'audio Kokoro\n');
}

console.log('='.repeat(70) + '\n');

testMultilingualGeneration();
