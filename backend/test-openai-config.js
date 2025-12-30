require('dotenv').config();
const OpenAI = require('openai');

console.log('\n🔍 VÉRIFICATION DE LA CONFIGURATION OPENAI');
console.log('='.repeat(80));

// 1. Vérifier la présence de la clé
console.log('\n1️⃣ Présence de la clé:');
if (!process.env.OPENAI_API_KEY) {
  console.log('   ❌ OPENAI_API_KEY non trouvée dans .env');
  process.exit(1);
}
console.log('   ✅ OPENAI_API_KEY trouvée');
console.log('   📏 Longueur:', process.env.OPENAI_API_KEY.length, 'caractères');
console.log('   🔑 Début:', process.env.OPENAI_API_KEY.substring(0, 25) + '...');

// 2. Tester la connexion OpenAI
console.log('\n2️⃣ Test de connexion OpenAI:');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testOpenAI() {
  try {
    console.log('   🔄 Envoi d\'une requête de test...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu réponds en JSON. Pas de texte supplémentaire.'
        },
        {
          role: 'user',
          content: 'Analyse cet article: "Le président inaugure un nouveau stade". Réponds avec: {"category": "Sport", "sentiment": 0.5}'
        }
      ],
      max_tokens: 50,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });
    
    const response = completion.choices[0]?.message?.content;
    console.log('   ✅ Connexion réussie !');
    console.log('   📨 Réponse:', response);
    
    // 3. Vérifier le quota
    console.log('\n3️⃣ Quota OpenAI:');
    console.log('   ℹ️  Tokens utilisés:', completion.usage?.total_tokens || 0);
    console.log('   ℹ️  Modèle:', completion.model);
    console.log('\n   🔗 Vérifier votre usage: https://platform.openai.com/usage');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ TOUT FONCTIONNE ! L\'enrichissement IA devrait être opérationnel.\n');
    
  } catch (error) {
    console.log('   ❌ ERREUR lors du test !');
    console.log('\n📋 Détails de l\'erreur:');
    console.log('   Type:', error.constructor.name);
    console.log('   Message:', error.message);
    
    if (error.status) {
      console.log('   Status HTTP:', error.status);
    }
    
    if (error.code === 'insufficient_quota') {
      console.log('\n💰 PROBLÈME DE QUOTA:');
      console.log('   ❌ Votre quota OpenAI est épuisé');
      console.log('   🔗 Vérifier: https://platform.openai.com/usage');
      console.log('   💳 Ajouter des crédits: https://platform.openai.com/account/billing');
    } else if (error.status === 401) {
      console.log('\n🔑 PROBLÈME D\'AUTHENTIFICATION:');
      console.log('   ❌ La clé API est invalide ou expirée');
      console.log('   🔗 Générer une nouvelle clé: https://platform.openai.com/api-keys');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.log('\n🌐 PROBLÈME DE RÉSEAU:');
      console.log('   ❌ Impossible de joindre les serveurs OpenAI');
      console.log('   🔄 Vérifiez votre connexion internet');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('❌ L\'enrichissement IA ne peut pas fonctionner actuellement.\n');
    process.exit(1);
  }
}

testOpenAI();
