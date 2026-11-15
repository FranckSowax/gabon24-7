/**
 * Service d'analyse d'articles avec OpenAI GPT-4.1-mini
 * Utilise Gemini comme fallback via gemini-service
 */

const fetch = require('node-fetch');
const geminiService = require('./gemini-service');

/**
 * Générer un article sponsorisé complet avec Gemini 3 Pro
 * En tant que rédacteur en chef web gabonais professionnel
 */
async function generateSponsoredArticle(briefInfo) {
  try {
    console.log('📝 Génération article sponsorisé avec Gemini 3...');
    
    // Le service Gemini vérifie lui-même sa clé API

    const { 
      company_name,
      product_service,
      key_message,
      target_audience,
      call_to_action,
      tone = 'professionnel',
      category = 'business'
    } = briefInfo;

    // Prompt rédacteur en chef gabonais
    const prompt = `Tu es un rédacteur en chef web gabonais expérimenté pour Gabon Insight, le premier média digital du Gabon. 
    
CONTEXTE:
Tu dois rédiger un article sponsorisé de qualité éditoriale pour un client. L'article doit respecter les standards journalistiques tout en mettant en valeur l'entreprise de manière naturelle et engageante.

BRIEF CLIENT:
- Entreprise: ${company_name}
- Produit/Service: ${product_service}
- Message clé: ${key_message}
- Audience cible: ${target_audience}
- Appel à l'action: ${call_to_action}
- Ton souhaité: ${tone}
- Catégorie: ${category}

CONSIGNES ÉDITORIALES STRICTES:

1. TITRE (60-80 caractères)
   - Accrocheur, informatif, SEO-friendly
   - Commence par un verbe d'action ou chiffre
   - Évite le clickbait, reste crédible
   - Exemple: "${company_name} révolutionne le ${category} au Gabon"

2. SOUS-TITRE (100-150 caractères)
   - Complète le titre avec l'information clé
   - Précise la valeur ajoutée unique
   - Ton neutre et informatif

3. CHAPÔ / RÉSUMÉ (150-200 mots)
   - Répond aux 5W (Who, What, When, Where, Why)
   - Contextualisation gabonaise importante
   - Mentionne l'impact local ou économique
   - Style journalistique neutre

4. CORPS DE L'ARTICLE (600-800 mots, structuré en 4-5 paragraphes)

   **Introduction contextuelle (120-150 mots)**
   - Situation actuelle du marché gabonais
   - Enjeux du secteur
   - Transition naturelle vers l'entreprise
   ⚠️ N'utilise PAS de mention "Paragraphe 1" ou numérotation

   **Présentation de l'entreprise (150-180 mots)**
   - Historique, valeurs, mission
   - Équipe, expertise locale
   - Ancrage territorial au Gabon (ville, quartier)
   - Références ou témoignages si pertinent

   **Le produit/service en détail (180-200 mots)**
   - Caractéristiques techniques/fonctionnelles
   - Avantages concrets pour les Gabonais
   - Innovation ou différenciation
   - Prix/tarifs si approprié (en FCFA)

   **Impact et bénéfices (120-150 mots)**
   - Résultats mesurables ou attendus
   - Témoignages clients gabonais (invente-les de façon réaliste)
   - Impact économique ou social local

   **Conclusion & CTA (80-100 mots)**
   - Résumé des points clés
   - Appel à l'action naturel: "${call_to_action}"
   - Informations pratiques (contact, site, adresse)
   
   ⚠️ IMPORTANT: Rédige le contenu de façon fluide SANS numérotation ni mention "Paragraphe X"

5. STYLE RÉDACTIONNEL GABONAIS:
   - Vocabulaire adapté au contexte local
   - Références culturelles gabonaises pertinentes
   - Mentionne des lieux réels: Libreville, Port-Gentil, quartiers connus
   - Ton ${tone} mais accessible
   - Évite le jargon excessif
   - Phrases courtes (15-20 mots max)

6. SEO & MOTS-CLÉS:
   - Intègre naturellement: "${product_service}", "${category}", "Gabon", "${company_name}"
   - Utilise synonymes et variations
   - Structure avec sous-titres H3 pertinents

7. CATÉGORIE: ${category}
   Adapte le vocabulaire et les références selon:
   - business → économie, entrepreneuriat, développement
   - tech → innovation, digital, technologie
   - santé → bien-être, médecine, prévention
   - éducation → formation, apprentissage, jeunesse

IMPORTANT:
- Reste objectif, style journalistique
- Évite superlatifs excessifs ("meilleur", "unique", "révolutionnaire")
- Vérifie cohérence: prix en FCFA, mesures métriques
- Cite sources ou références si pertinent
- L'article doit pouvoir être publié tel quel

FORMAT DE RÉPONSE (JSON strict):
{
  "title": "Titre accrocheur 60-80 caractères",
  "subtitle": "Sous-titre informatif 100-150 caractères",
  "summary": "Chapô/résumé 150-200 mots avec 5W et contexte gabonais",
  "content": "Corps complet de l'article 600-800 mots, structuré en paragraphes bien distincts. Chaque paragraphe séparé par deux retours à la ligne.\\n\\nUtilise des sous-titres ### pour structurer.\\n\\nIntègre naturellement les informations du client.",
  "author": "Gabon Insight",
  "category": "${category}",
  "keywords": ["mot-clé1", "mot-clé2", "mot-clé3", "mot-clé4", "mot-clé5"]
}

Génère maintenant l'article complet en JSON. Sois créatif, professionnel et contextualise au Gabon.`;

    // Utilisation de Gemini 3 Pro (Mode JSON)
    const articleData = await geminiService.generateJSON(prompt, {
      systemPrompt: 'Tu es un rédacteur en chef web gabonais professionnel. Génère un article journalistique complet en JSON valide.',
      temperature: 0.7
    });

    console.log('✅ Article généré avec succès (Gemini 3)');
    return {
      success: true,
      article: articleData
    };

  } catch (error) {
    console.error('❌ Erreur génération article:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Générer une image de couverture pour article avec Gemini 3 Image
 * Contexte africain/gabonais, format 16:9
 */
async function generateArticleImage(articleInfo) {
  const {
    title,
    category,
    company_name,
    product_service,
    key_message
  } = articleInfo;

  // Générer prompt contextuel gabonais pour l'image
  const imagePrompt = generateImagePrompt(title, category, company_name, product_service, key_message);
  console.log('🖼️ Prompt image:', imagePrompt);

  // 1. Tentative Gemini 3 Image
  try {
    console.log('🎨 Tentative Gemini 3 Image...');
    
    // Appel API Gemini 3 Image (Retourne Data URI)
    const imageUrl = await geminiService.generateImage(imagePrompt, {
      aspectRatio: '16:9'
    });
    
    console.log('✅ Image générée (Gemini 3)');
    return {
      success: true,
      image_url: imageUrl
    };

  } catch (geminiError) {
    console.warn(`⚠️ Gemini Image échoué (${geminiError.message})`);
    return {
      success: false,
      error: geminiError.message
    };
  }
}

/**
 * Générer un prompt optimisé pour Nano Banana
 * Contexte africain/gabonais, style photographique professionnel
 */
function generateImagePrompt(title, category, companyName, productService, keyMessage) {
  // Contexte gabonais de base
  const gabonContext = "African setting, Gabon, Libreville cityscape, modern African business environment";
  
  // Style visuel par catégorie
  const categoryStyles = {
    business: "professional office space, modern African entrepreneurs, business meeting, sleek workspace, glass buildings, contemporary African business district",
    tech: "modern technology, digital innovation, African tech hub, computers and smartphones, futuristic office, young African professionals working on laptops",
    santé: "modern African hospital, medical professionals, clean healthcare facility, African doctors and nurses, wellness center, medical equipment",
    education: "modern African classroom, students learning, educational technology, university campus in Africa, library, young African students",
    finance: "African bank interior, financial district, modern office towers, professionals analyzing data, stock market screens",
    retail: "modern African shopping mall, retail store, customers shopping, contemporary boutique, commercial district",
    food: "African restaurant, modern kitchen, food preparation, culinary setting, dining experience, African cuisine presentation",
    real_estate: "modern African buildings, real estate development, new construction, luxury apartments, contemporary architecture",
    transport: "modern African city streets, transportation hub, vehicles, logistics center, urban mobility",
    tourism: "beautiful Gabonese landscape, tourist destination, beach resort, national park, eco-tourism, tropical scenery"
  };

  // Récupérer style selon catégorie
  const categoryStyle = categoryStyles[category] || categoryStyles.business;

  // Éléments visuels liés au produit/service
  let productVisuals = "";
  if (productService) {
    const productLower = productService.toLowerCase();
    if (productLower.includes('mobile') || productLower.includes('app')) {
      productVisuals = ", smartphone displaying app interface, mobile technology";
    } else if (productLower.includes('web') || productLower.includes('site')) {
      productVisuals = ", computer screen showing website, web interface";
    } else if (productLower.includes('food') || productLower.includes('restaurant')) {
      productVisuals = ", delicious food presentation, dining atmosphere";
    } else if (productLower.includes('health') || productLower.includes('medical')) {
      productVisuals = ", medical consultation, healthcare service";
    } else if (productLower.includes('education') || productLower.includes('training')) {
      productVisuals = ", learning environment, educational materials";
    }
  }

  // Éléments du message clé
  let messageVisuals = "";
  if (keyMessage) {
    const messageLower = keyMessage.toLowerCase();
    if (messageLower.includes('innovation') || messageLower.includes('nouveau')) {
      messageVisuals = ", innovative technology, cutting-edge solution";
    } else if (messageLower.includes('rapide') || messageLower.includes('efficace')) {
      messageVisuals = ", dynamic action, efficiency in motion";
    } else if (messageLower.includes('qualité') || messageLower.includes('premium')) {
      messageVisuals = ", luxury details, premium quality, high-end presentation";
    } else if (messageLower.includes('accessible') || messageLower.includes('pour tous')) {
      messageVisuals = ", inclusive environment, diverse people";
    }
  }

  // Construction du prompt complet
  const prompt = `Professional commercial photography for ${companyName || 'a company'} in Gabon. 
${gabonContext}. 
${categoryStyle}${productVisuals}${messageVisuals}. 
Vibrant colors, natural lighting, authentic African representation, modern and professional aesthetic. 
High quality commercial photo, 16:9 aspect ratio, suitable for article header image. 
Photo realistic, sharp focus, professional composition, no text overlay, no watermarks.
Representing: ${title}`;

  return prompt;
}

/**
 * Générer une leçon pédagogique pour un module de formation avec Gemini 3 Pro
 * @param {Object} moduleInfo - Informations du module
 * @returns {Promise<Object>} Leçon générée
 */
async function generateModuleLesson(moduleInfo) {
  try {
    console.log(`📚 Génération leçon Gemini 3: ${moduleInfo.title}...`);
    
    const {
      title,
      description,
      opportunity_context, // Contexte de l'opportunité
      project_info,        // Infos carte Mon Projet
      category,
      difficulty_level = 'débutant'
    } = moduleInfo;

    // Prompt pédagogique gabonais
    const prompt = `Tu es un formateur professionnel gabonais expert en pédagogie digitale.

CONTEXTE DE LA FORMATION:
Tu crées une leçon complète et engageante pour un module de formation en ligne destiné aux entrepreneurs et professionnels gabonais.

MODULE À DÉVELOPPER:
- Titre: ${title}
- Description: ${description}
- Catégorie: ${category}
- Niveau: ${difficulty_level}

CONTEXTE BUSINESS (de l'opportunité):
${opportunity_context}

INFORMATIONS DU PROJET (carte Mon Projet):
${project_info}

CONSIGNES PÉDAGOGIQUES:

1. STRUCTURE DE LA LEÇON (2000-3000 mots):

   **Introduction (200 mots)**
   - Accroche engageante liée au contexte gabonais
   - Pourquoi ce module est crucial pour réussir au Gabon
   - Objectifs d'apprentissage clairs (3-4 points)
   - Ce que l'apprenant saura faire après cette leçon

   **Partie 1: Fondamentaux (600 mots)**
   - Concepts de base expliqués simplement
   - Exemples concrets du marché gabonais (Libreville, Port-Gentil, etc.)
   - Définitions clés avec vocabulaire local
   - Schémas conceptuels décrits en texte

   **Partie 2: Application Pratique (800 mots)**
   - Étapes concrètes à suivre
   - Cas pratiques gabonais réels
   - Erreurs courantes à éviter au Gabon
   - Conseils d'experts locaux
   - Chiffres et données du marché gabonais (en FCFA)

   **Partie 3: Outils et Ressources (400 mots)**
   - Outils recommandés disponibles au Gabon
   - Ressources locales (institutions, contacts, sites)
   - Templates et frameworks adaptés au contexte
   - Budget estimatif en FCFA

   **Conclusion et Action (200 mots)**
   - Résumé des points clés (5 takeaways)
   - Plan d'action immédiat (3 étapes)
   - Prochaines étapes vers le module suivant
   - Motivation et encouragement

2. STYLE PÉDAGOGIQUE:
   - Ton convivial et encourageant
   - Phrases courtes et claires (15-20 mots max)
   - Vocabulaire accessible mais professionnel
   - Exemples du quotidien gabonais
   - Histoires inspirantes d'entrepreneurs locaux
   - Interpellation directe ("vous", "votre entreprise")

3. ADAPTATION AU CONTEXTE GABONAIS:
   - Références aux quartiers, villes (Libreville, Port-Gentil, Franceville)
   - Prix en FCFA avec ordres de grandeur réalistes
   - Contraintes locales (électricité, internet, administration)
   - Opportunités spécifiques au Gabon
   - Culture entrepreneuriale gabonaise
   - Réglementations et procédures locales

4. PÉDAGOGIE ACTIVE:
   - Questions de réflexion tout au long
   - Exercices pratiques à faire (3-4)
   - Auto-évaluation en fin de module
   - Challenges à relever
   - Points de vigilance encadrés

5. FORMAT MARKDOWN:
   - Titres et sous-titres clairs (##, ###)
   - Listes à puces pour clarté
   - Tableaux pour comparaisons
   - Blocs "💡 Astuce", "⚠️ Attention", "✅ À faire"
   - Mise en gras des points importants

OBJECTIF FINAL:
L'apprenant doit pouvoir IMMÉDIATEMENT appliquer ce qu'il a appris à son projet gabonais concret. Chaque concept doit être illustré par un exemple local tangible.

Génère maintenant une leçon complète, structurée, engageante et 100% adaptée au contexte entrepreneurial gabonais.`;

    // Appel à Gemini 3
    const lessonContent = await geminiService.generateText(prompt, {
      systemPrompt: "Tu es un formateur expert en création de contenu pédagogique de qualité.",
      temperature: 0.7
    });

    console.log(`✅ Leçon Gemini 3 générée: ${lessonContent.length} caractères`);

    return {
      success: true,
      lesson_content: lessonContent,
      word_count: lessonContent.split(/\s+/).length,
      estimated_duration: Math.ceil(lessonContent.split(/\s+/).length / 200) // minutes de lecture
    };

  } catch (error) {
    console.error('❌ Erreur génération leçon:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Générer une image d'illustration pour un module de formation avec Gemini 3 Image
 * @param {Object} moduleInfo - Informations du module
 * @returns {Promise<Object>} URL de l'image générée
 */
async function generateModuleImage(moduleInfo) {
  try {
    console.log(`🎨 Génération image module Gemini 3: ${moduleInfo.title}...`);
    
    const { title, category, description } = moduleInfo;

    // Styles par catégorie de formation
    const categoryStyles = {
      'business': 'modern African office, professional business meeting, entrepreneurs working, business charts and graphs',
      'marketing': 'digital marketing workspace, social media management, African marketers at work, creative campaigns',
      'finance': 'financial analysis, accounting workspace, African finance professionals, calculator and reports',
      'tech': 'technology workspace, coding on computers, African tech professionals, modern gadgets',
      'sales': 'sales presentation, client meeting, handshake, African sales team, product demonstration',
      'management': 'team management, leadership meeting, African managers planning, organizational charts',
      'real_estate': 'real estate office, property viewing, African real estate agent, modern buildings',
      'ecommerce': 'online shopping interface, package delivery, African e-commerce workspace, digital storefront',
      'tourism': 'tourism office, travel planning, Gabonese destinations, tourism professionals',
      'default': 'professional workspace, African professionals collaborating, modern office environment'
    };

    const categoryStyle = categoryStyles[category] || categoryStyles['default'];

    // Contexte gabonais de base
    const gabonContext = "African setting, Gabon, Libreville modern cityscape, contemporary African business environment, tropical atmosphere";

    // Prompt image pédagogique
    const imagePrompt = `Professional educational illustration for training module in Gabon.
${gabonContext}.
${categoryStyle}.
Clean, bright, welcoming learning environment.
African professionals engaged in learning and development.
Modern training facility, educational materials visible.
Vibrant colors, natural lighting, authentic African representation.
Inspiring and motivational atmosphere for online learning.
High quality educational photo, 16:9 aspect ratio.
Photo realistic, sharp focus, professional composition, no text overlay.
Representing: ${title}`;

    console.log('📸 Prompt image:', imagePrompt.substring(0, 100) + '...');

    // 1. Tentative Gemini 3 Image
    try {
      // Appel Gemini 3 Image (Retourne Data URI)
      const imageUrl = await geminiService.generateImage(imagePrompt, {
        aspectRatio: '16:9'
      });

      console.log(`✅ Image générée (Gemini 3)`);
      return {
        success: true,
        image_url: imageUrl
      };
    } catch (geminiError) {
      console.warn(`⚠️ Gemini Image échoué:`, geminiError.message);
      throw geminiError;
    }

  } catch (error) {
    console.error('❌ Erreur génération image:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateSponsoredArticle,
  generateArticleImage,
  generateModuleLesson,
  generateModuleImage
};
