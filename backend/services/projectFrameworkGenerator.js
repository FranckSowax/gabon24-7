const geminiService = require('./gemini-service');

/**
 * Génère un document cadre complet pour un projet à partir des réponses du formulaire
 */
async function generateProjectFramework(formData) {
  const prompt = `Tu es un expert en création d'entreprise et business planning au Gabon. 
Tu dois créer un document cadre COMPLET et STRUCTURÉ pour un projet entrepreneurial basé sur les informations suivantes.

INFORMATIONS DU PROJET:

## Idée & Vision
- Idée: ${formData.project_idea}
- Vision: ${formData.project_vision}
- Problème résolu: ${formData.problem_solving}

## Marché & Cible
- Audience cible: ${formData.target_audience}
- Taille du marché: ${formData.market_size}
- Concurrents: ${formData.competitors || 'Non spécifié'}
- Valeur unique: ${formData.unique_value}

## Business Model
- Modèle de revenus: ${formData.revenue_model}
- Stratégie de prix: ${formData.pricing_strategy}
- Structure de coûts: ${formData.cost_structure || 'Non spécifié'}
- Financement nécessaire: ${formData.funding_needed || 'Non spécifié'}

## Ressources
- Taille équipe: ${formData.team_size}
- Compétences clés: ${formData.key_skills.join(', ')}
- Timeline: ${formData.timeline}
- Localisation: ${formData.location || 'Gabon'}

## Objectifs
- Court terme: ${formData.short_term_goals}
- Long terme: ${formData.long_term_goals}
- Métriques de succès: ${formData.success_metrics || 'Non spécifié'}
- Risques: ${formData.risks || 'Non spécifié'}

CONSIGNES:
Crée un document cadre professionnel en français avec les sections suivantes:

# 1. RÉSUMÉ EXÉCUTIF
- Présentation concise du projet (200-300 mots)
- Proposition de valeur unique
- Opportunité de marché
- Objectifs principaux

# 2. ANALYSE DE MARCHÉ
- Contexte du marché gabonais
- Taille et potentiel du marché
- Analyse de la concurrence
- Positionnement stratégique
- Tendances et opportunités

# 3. BUSINESS MODEL
- Modèle économique détaillé
- Sources de revenus
- Structure de coûts
- Seuil de rentabilité estimé
- Projections financières (3 ans)

# 4. STRATÉGIE MARKETING
- Segmentation client
- Stratégie de positionnement
- Mix marketing (4P)
- Canaux d'acquisition
- Budget marketing estimé

# 5. PLAN OPÉRATIONNEL
- Organisation et équipe
- Processus clés
- Ressources nécessaires
- Partenaires stratégiques
- Infrastructure et technologie

# 6. PLAN D'ACTION
- Roadmap de lancement (phases)
- Jalons clés avec timeline
- Quick wins (3 premiers mois)
- Priorités par trimestre
- KPIs de suivi

# 7. ANALYSE DES RISQUES
- Risques identifiés
- Impact et probabilité
- Plans de mitigation
- Scénarios alternatifs

# 8. BESOINS EN FINANCEMENT
- Montant total requis
- Utilisation des fonds
- Sources de financement potentielles
- Retour sur investissement estimé

# 9. RECOMMANDATIONS IA
- Actions prioritaires immédiates
- Ressources à mobiliser en premier
- Partenariats à rechercher
- Formations recommandées
- Outils et technologies suggérés

IMPORTANT:
- Contexte 100% gabonais (prix en FCFA, références locales)
- Données réalistes et chiffrées
- Ton professionnel mais accessible
- Sections bien structurées avec markdown
- Minimum 3000 mots au total
- Exemples concrets et actionnables

Génère maintenant ce document cadre complet:`;

  try {
    console.log('🤖 Génération document cadre avec Gemini 3 Pro...');

    const frameworkDocument = await geminiService.generateText(prompt, {
      systemPrompt: "Tu es un consultant expert en business plan pour le marché gabonais.",
      temperature: 0.7
    });

    console.log('✅ Document cadre généré:', frameworkDocument.length, 'caractères');

    return {
      success: true,
      document: frameworkDocument,
      metadata: {
        word_count: frameworkDocument.split(/\s+/).length,
        generated_at: new Date().toISOString(),
        model: 'gemini-3-pro'
      }
    };

  } catch (error) {
    console.error('❌ Erreur génération document cadre:', error);
    throw error;
  }
}

/**
 * Génère une présentation et description avec IA
 */
async function generateProjectPresentation(formData) {
  const prompt = `Tu es un expert en pitch de projets entrepreneuriaux au Gabon.
Génère une présentation professionnelle pour ce projet:

- Idée: ${formData.project_idea}
- Vision: ${formData.project_vision}
- Problème résolu: ${formData.problem_solving}
- Audience cible: ${formData.target_audience}
- Valeur unique: ${formData.unique_value}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans backticks):
{
  "presentation": "[Présentation accrocheuse du projet en 2-3 phrases, max 200 caractères]",
  "description": "[Description détaillée du projet en 3-4 phrases, max 400 caractères]",
  "problematique_centrale": "[UNE SEULE phrase résumant le problème central que résout ce projet, max 100 caractères]",
  "avantage_concurrentiel": "[UNE SEULE phrase décrivant l'avantage concurrentiel principal, max 100 caractères]"
}

IMPORTANT: Contexte gabonais, ton professionnel, phrases percutantes.`;

  try {
    const result = await geminiService.generateText(prompt, {
      systemPrompt: "Tu es un expert en pitch startup. Réponds uniquement en JSON valide.",
      temperature: 0.7
    });
    
    // Nettoyer la réponse des backticks markdown si présents
    let cleanResult = result.trim();
    if (cleanResult.startsWith('```json')) {
      cleanResult = cleanResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanResult.startsWith('```')) {
      cleanResult = cleanResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(cleanResult);
  } catch (error) {
    console.error('⚠️ Erreur génération présentation IA:', error);
    // Fallback sans IA
    return {
      presentation: formData.project_idea.substring(0, 200),
      description: `${formData.project_idea}. ${formData.project_vision}`.substring(0, 400),
      problematique_centrale: formData.problem_solving.substring(0, 100),
      avantage_concurrentiel: formData.unique_value.substring(0, 100)
    };
  }
}

/**
 * Extrait les informations clés du document pour créer la carte projet
 */
async function extractProjectCardData(frameworkDocument, formData) {
  // Générer présentation et description avec IA
  const aiPresentation = await generateProjectPresentation(formData);
  
  // Générer un titre court basé sur l'idée
  const title = formData.project_idea.length > 60 
    ? formData.project_idea.substring(0, 60) + '...'
    : formData.project_idea;

  // Utiliser la description générée par IA
  const description = aiPresentation.description || frameworkDocument.substring(0, 300) + '...';

  // Déterminer la catégorie basée sur les mots-clés
  const category = determineCategory(formData);

  // Calculer le budget estimé
  const budget = extractBudget(formData.funding_needed);

  // Déterminer la phase du projet
  const phase = determinePhase(formData.timeline);

  return {
    title,
    description,
    presentation: aiPresentation.presentation,
    problematique_centrale: aiPresentation.problematique_centrale,
    avantage_concurrentiel: aiPresentation.avantage_concurrentiel,
    category,
    budget,
    phase,
    location: formData.location || 'Gabon',
    team_size: formData.team_size,
    timeline: formData.timeline,
    target_audience: formData.target_audience,
    unique_value: formData.unique_value,
    key_skills: formData.key_skills,
    short_term_goals: formData.short_term_goals,
    long_term_goals: formData.long_term_goals
  };
}

/**
 * Détermine la catégorie du projet basée sur les mots-clés
 */
function determineCategory(formData) {
  const text = `${formData.project_idea} ${formData.project_vision} ${formData.unique_value}`.toLowerCase();

  const categories = {
    'tech': ['application', 'plateforme', 'digital', 'web', 'mobile', 'technologie', 'logiciel'],
    'commerce': ['vente', 'boutique', 'commerce', 'e-commerce', 'magasin', 'distribution'],
    'service': ['service', 'conseil', 'formation', 'accompagnement', 'assistance'],
    'restauration': ['restaurant', 'repas', 'cuisine', 'livraison', 'food', 'alimentation'],
    'agriculture': ['agriculture', 'élevage', 'ferme', 'production', 'culture'],
    'tourisme': ['tourisme', 'hôtel', 'voyage', 'hébergement', 'loisir'],
    'santé': ['santé', 'médical', 'clinique', 'bien-être', 'soins'],
    'éducation': ['éducation', 'formation', 'école', 'cours', 'enseignement'],
    'immobilier': ['immobilier', 'construction', 'logement', 'bâtiment'],
    'transport': ['transport', 'logistique', 'livraison', 'déplacement']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }

  return 'autre';
}

/**
 * Extrait le montant du budget (gère les espaces: "5 000 000" → 5000000)
 */
function extractBudget(fundingText) {
  if (!fundingText) return 0;

  // Supprimer tous les espaces et caractères non numériques sauf virgules et points
  const cleanedText = fundingText.replace(/\s/g, ''); // Supprimer espaces
  
  // Extraire les nombres (avec ou sans séparateurs)
  const numbers = cleanedText.match(/[\d.,]+/g);
  if (!numbers) return 0;

  // Prendre le premier nombre trouvé et nettoyer
  let numStr = numbers[0];
  // Supprimer les séparateurs de milliers (virgules ou points selon format)
  numStr = numStr.replace(/[.,]/g, '');
  
  const amount = parseInt(numStr);
  return isNaN(amount) ? 0 : amount;
}

/**
 * Détermine la phase du projet basée sur la timeline
 */
function determinePhase(timeline) {
  const phases = {
    '1-3-mois': 'ideation',
    '3-6-mois': 'planning',
    '6-12-mois': 'development',
    '12+-mois': 'planning'
  };

  return phases[timeline] || 'ideation';
}

/**
 * Génère un résumé court pour la carte projet
 */
function generateProjectSummary(formData) {
  return `${formData.project_idea.substring(0, 150)}... 
  
Cible: ${formData.target_audience.substring(0, 100)}
Valeur unique: ${formData.unique_value.substring(0, 100)}`;
}

module.exports = {
  generateProjectFramework,
  extractProjectCardData,
  generateProjectSummary
};
