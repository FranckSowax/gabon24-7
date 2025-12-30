const geminiService = require('./gemini-service');

/**
 * Générer un article sponsorisé avec Gemini 3 Pro (ou fallback)
 * @param {Object} params - Paramètres de l'article
 * @returns {Promise<Object>} Article généré
 */
async function generateSponsoredArticle(params) {
  try {
    const {
      title,
      subtitle,
      category,
      companyName,
      productService,
      targetAudience,
      keyMessage,
      callToAction
    } = params;

    console.log(`🤖 Génération d'article IA pour: ${companyName}`);

    const prompt = `Tu es un journaliste professionnel gabonais expérimenté. Écris un article sponsorisé de haute qualité en français qui présente "${productService}" de ${companyName}.

INFORMATIONS:
- Titre: ${title}
- Sous-titre: ${subtitle || ''}
- Catégorie: ${category}
- Cible: ${targetAudience}
- Message clé: ${keyMessage || 'Innovation et qualité'}
- Call-to-action: ${callToAction || 'Découvrez-en plus'}

CONSIGNES:
1. Rédige un article informatif et crédible, pas trop promotionnel
2. Longueur: entre 500 et 800 mots
3. Utilise un ton journalistique professionnel adapté au marché gabonais
4. Structure l'article avec des sous-titres (utilise ##)
5. Inclus des éléments factuels et du contexte local (Gabon, Afrique centrale)
6. Intègre naturellement les informations commerciales
7. Termine par un paragraphe avec l'appel à l'action de manière subtile
8. Ajoute "(Article Sponsorisé)" à la fin

STRUCTURE RECOMMANDÉE:
- Introduction accrocheuse
- Contexte et problématique
- Présentation de la solution
- Avantages et bénéfices
- Témoignages ou cas d'usage (fictifs mais réalistes)
- Conclusion avec appel à l'action

Écris l'article maintenant:`;

    // Utiliser generateText car on attend du texte structuré en markdown, pas du JSON
    const generatedContent = await geminiService.generateText(prompt, {
      systemPrompt: "Tu es un journaliste professionnel gabonais spécialisé dans la rédaction d'articles sponsorisés de haute qualité. Tu écris en français avec un style adapté au marché gabonais.",
      temperature: 0.7
    });

    console.log(`✅ Article généré: ${generatedContent.length} caractères`);

    return {
      success: true,
      content: generatedContent,
      wordCount: generatedContent.split(/\s+/).length,
      model: 'gemini-3-pro' // ou celui utilisé par le service
    };

  } catch (error) {
    console.error('❌ Erreur génération article IA:', error);
    throw new Error('Erreur lors de la génération de l\'article: ' + error.message);
  }
}

/**
 * Générer une description courte pour bannière
 * @param {Object} params - Paramètres
 * @returns {Promise<string>} Description
 */
async function generateBannerDescription(params) {
  try {
    const { companyName, productService, targetAudience } = params;

    const prompt = `Écris une description courte et impactante (max 150 caractères) pour une bannière publicitaire.

Entreprise: ${companyName}
Produit/Service: ${productService}
Cible: ${targetAudience}

La description doit être:
- Accrocheuse et persuasive
- Courte (max 150 caractères)
- En français
- Orientée bénéfice client

Écris uniquement la description, sans guillemets ni formatage:`;

    const description = await geminiService.generateText(prompt, {
      systemPrompt: "Tu es un expert en copywriting publicitaire.",
      temperature: 0.8
    });

    return description.trim();

  } catch (error) {
    console.error('❌ Erreur génération description:', error);
    throw error;
  }
}

/**
 * Améliorer/Corriger un texte existant
 * @param {string} text - Texte à améliorer
 * @param {string} context - Contexte
 * @returns {Promise<string>} Texte amélioré
 */
async function improveText(text, context = 'article sponsorisé') {
  try {
    const prompt = `Améliore ce texte pour un ${context}. Corrige les fautes, améliore le style et rends-le plus professionnel tout en gardant le sens original.

Texte original:
${text}

Texte amélioré:`;

    const improved = await geminiService.generateText(prompt, {
      systemPrompt: "Tu es un rédacteur professionnel expert en français.",
      temperature: 0.5
    });

    return improved.trim();

  } catch (error) {
    console.error('❌ Erreur amélioration texte:', error);
    throw error;
  }
}

/**
 * Générer des suggestions de titres
 * @param {Object} params - Paramètres
 * @returns {Promise<string[]>} Liste de titres
 */
async function generateTitleSuggestions(params) {
  try {
    const { companyName, productService, category } = params;

    const prompt = `Génère 5 titres accrocheurs pour un article sponsorisé.

Entreprise: ${companyName}
Produit/Service: ${productService}
Catégorie: ${category}

Les titres doivent être:
- Informatifs mais intrigants
- Entre 50 et 80 caractères
- Optimisés pour le SEO
- Adaptés au marché gabonais

Génère uniquement les 5 titres, un par ligne, sans numérotation:`;

    const response = await geminiService.generateText(prompt, {
      temperature: 0.9
    });

    const titles = response
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[\d\-\.\)]\s*/, '').trim());

    return titles;

  } catch (error) {
    console.error('❌ Erreur génération titres:', error);
    throw error;
  }
}

/**
 * Analyser le sentiment d'un texte
 * @param {string} text - Texte à analyser
 * @returns {Promise<Object>} Analyse sentiment
 */
async function analyzeSentiment(text) {
  try {
    const prompt = `Analyse le sentiment et le ton de ce texte. Réponds avec un objet JSON contenant:
{
  "sentiment": "positive|neutral|negative",
  "tone": "professional|casual|promotional",
  "score": 0-100,
  "keywords": ["mot1", "mot2", ...]
}

Texte:
${text}`;

    const analysis = await geminiService.generateJSON(prompt, {
      temperature: 0.3
    });

    return analysis;

  } catch (error) {
    console.error('❌ Erreur analyse sentiment:', error);
    return {
      sentiment: 'neutral',
      tone: 'professional',
      score: 50,
      keywords: []
    };
  }
}

/**
 * Régénérer un document complet basé sur un prompt enrichi
 * @param {string} prompt - Prompt complet contenant contexte et instructions
 * @returns {Promise<string>} Contenu généré
 */
async function regenerateDocument(prompt) {
  try {
    const content = await geminiService.generateText(prompt, {
      systemPrompt: "Tu es un consultant expert en business et entrepreneuriat au Gabon. Tu assistes les entrepreneurs dans la création de documents professionnels (Business Plan, Plan d'Action, Tests de Compétences). Tu réponds en Markdown structuré.",
      temperature: 0.7
    });

    return content.trim();

  } catch (error) {
    console.error('❌ Erreur régénération document:', error);
    throw error;
  }
}

/**
 * Vérifier si le service IA est configuré
 * @returns {boolean}
 */
function isConfigured() {
  // Le service Gemini gère lui-même sa config
  return true; 
}

module.exports = {
  generateSponsoredArticle,
  generateBannerDescription,
  improveText,
  generateTitleSuggestions,
  analyzeSentiment,
  regenerateDocument,
  isConfigured
};
