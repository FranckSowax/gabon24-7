 **Module Business Intelligence : Transformateur d'Actualités en Opportunités**

## **📋 Concept Clarifié**

### **Vision du Module**

Transformer l'actualité gabonaise quotidienne en opportunités business concrètes et personnalisées, créant un pipeline de conversion vers des services premium (études de marché, formations, consulting).

### **Parcours Utilisateur**

1. **Sélection** → L'utilisateur choisit 1-3 articles du jour  
2. **Profilage** → 3 questions rapides pour comprendre son contexte  
3. **Analyse IA** → Génération d'opportunités personnalisées  
4. **Teasing** → Aperçu gratuit avec options payantes pour approfondir  
5. **Conversion** → Vente d'études complètes, formations ou plans d'action

### **Modèle de Monétisation**

* **Gratuit** : 1 analyse/semaine (aperçu limité)  
* **Premium** : 5 analyses/jour \+ suggestions basiques  
* **Business** : Illimité \+ rapports détaillés \+ export  
* **Services additionnels** :  
  * Étude de marché complète : 50 000 XAF  
  * Formation en ligne : 25 000 XAF  
  * Plan d'action personnalisé : 35 000 XAF  
  * Consulting 1-to-1 : 100 000 XAF/session

---

## **🚀 Prompt Windsurf Cascade pour Développement**

\# Développement Module Business Opportunity Generator \- Gabon 24/7

\#\# Contexte du Projet

Tu es un développeur full-stack expert chargé de créer un module "Business Opportunities" innovant pour Gabon 24/7. Ce module utilise l'IA (OpenAI GPT-4) pour transformer les actualités quotidiennes en opportunités business personnalisées, avec intégration Netlify Functions pour le backend serverless.

\#\# Objectifs Techniques

\#\#\# Stack Technique  
\- \*\*Frontend\*\* : Next.js 14 avec TypeScript  
\- \*\*Backend\*\* : Netlify Functions (serverless)  
\- \*\*Base de données\*\* : Supabase (PostgreSQL)  
\- \*\*IA\*\* : OpenAI GPT-4 API  
\- \*\*Cache\*\* : Redis/Upstash pour optimisation  
\- \*\*Paiement\*\* : Stripe/PayStack pour services premium  
\- \*\*Analytics\*\* : Mixpanel pour tracking conversions

\#\# Architecture du Module

/app /business /page.tsx \# Page principale du module /opportunities /\[id\]/page.tsx \# Détail d'une opportunité /analysis /page.tsx \# Interface d'analyse /components /business /ArticleSelector.tsx \# Sélection articles (max 3\) /UserProfiler.tsx \# Questionnaire intelligent /OpportunityCard.tsx \# Carte opportunité générée /PaymentModal.tsx \# Modal achat étude/formation /AnalysisProgress.tsx \# Barre de progression analyse /netlify /functions /analyze-opportunities.ts \# Fonction serverless principale /generate-report.ts \# Génération PDF rapport /process-payment.ts \# Traitement paiement /track-analytics.ts \# Tracking utilisation /lib /openai /prompts.ts \# Prompts optimisés /analyzer.ts \# Logique d'analyse /business /opportunity-matcher.ts \# Matching opportunités /report-generator.ts \# Génération rapports /types /business.types.ts \# Types TypeScript

\#\# 1\. Schéma Base de Données Supabase

Crée ces nouvelles tables pour le module Business :

\`\`\`sql  
\-- Table des analyses d'opportunités  
CREATE TABLE opportunity\_analyses (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    user\_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,  
    selected\_articles jsonb NOT NULL, \-- IDs et titres des articles  
    user\_profile jsonb NOT NULL, \-- Réponses au questionnaire  
    opportunities jsonb NOT NULL, \-- Opportunités générées  
    ai\_tokens\_used integer DEFAULT 0,  
    analysis\_quality text CHECK (analysis\_quality IN ('basic', 'detailed', 'premium')),  
    created\_at timestamptz DEFAULT now()  
);

\-- Table des opportunités sauvegardées  
CREATE TABLE saved\_opportunities (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    analysis\_id uuid REFERENCES opportunity\_analyses(id),  
    user\_id uuid REFERENCES auth.users(id),  
    title text NOT NULL,  
    description text,  
    market\_size\_estimate text,  
    investment\_required text,  
    difficulty\_level integer CHECK (difficulty\_level BETWEEN 1 AND 5),  
    time\_to\_market text,  
    potential\_revenue text,  
    action\_steps jsonb,  
    resources\_needed jsonb,  
    is\_favorite boolean DEFAULT false,  
    implementation\_status text DEFAULT 'idea',  
    notes text,  
    created\_at timestamptz DEFAULT now(),  
    updated\_at timestamptz DEFAULT now()  
);

\-- Table des services premium vendus  
CREATE TABLE premium\_services (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    opportunity\_id uuid REFERENCES saved\_opportunities(id),  
    user\_id uuid REFERENCES auth.users(id),  
    service\_type text NOT NULL CHECK (service\_type IN ('market\_study', 'training', 'action\_plan', 'consulting')),  
    price integer NOT NULL,  
    payment\_status text DEFAULT 'pending',  
    payment\_reference text,  
    delivered\_at timestamptz,  
    delivery\_url text,  
    metadata jsonb DEFAULT '{}',  
    created\_at timestamptz DEFAULT now()  
);

\-- Table de tracking utilisation (pour limites freemium)  
CREATE TABLE opportunity\_usage (  
    id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    user\_id uuid REFERENCES auth.users(id),  
    date date NOT NULL DEFAULT CURRENT\_DATE,  
    analyses\_count integer DEFAULT 0,  
    last\_analysis\_at timestamptz,  
    UNIQUE(user\_id, date)  
);

\-- Indexes pour performance  
CREATE INDEX idx\_opportunities\_user ON opportunity\_analyses(user\_id, created\_at DESC);  
CREATE INDEX idx\_saved\_opportunities ON saved\_opportunities(user\_id, is\_favorite);  
CREATE INDEX idx\_premium\_services ON premium\_services(user\_id, service\_type);  
CREATE INDEX idx\_usage\_tracking ON opportunity\_usage(user\_id, date);

## **2\. Component Principal \- Sélecteur d'Articles**

// components/business/ArticleSelector.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import { Newspaper, TrendingUp, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';

interface Article {  
  id: string;  
  title: string;  
  description: string;  
  source: string;  
  category: string;  
  published\_at: string;  
  relevance\_score?: number;  
}

interface ArticleSelectorProps {  
  onSelectionComplete: (articles: Article\[\]) \=\> void;  
  maxSelection?: number;  
}

export default function ArticleSelector({   
  onSelectionComplete,   
  maxSelection \= 3   
}: ArticleSelectorProps) {  
  const \[articles, setArticles\] \= useState\<Article\[\]\>(\[\]);  
  const \[selectedArticles, setSelectedArticles\] \= useState\<Article\[\]\>(\[\]);  
  const \[loading, setLoading\] \= useState(true);  
  const \[filter, setFilter\] \= useState\<'all' | 'economic' | 'political' | 'social'\>('all');

  useEffect(() \=\> {  
    fetchTodayArticles();  
  }, \[filter\]);

  const fetchTodayArticles \= async () \=\> {  
    setLoading(true);  
      
    // Récupérer les articles du jour avec score de pertinence business  
    const { data, error } \= await supabase  
      .from('feed\_items')  
      .select('\*')  
      .gte('pub\_date', new Date().toISOString().split('T')\[0\])  
      .order('pub\_date', { ascending: false })  
      .limit(20);

    if (data) {  
      // Enrichir avec un score de pertinence business (simulé ici)  
      const enrichedArticles \= data.map(article \=\> ({  
        ...article,  
        relevance\_score: calculateBusinessRelevance(article)  
      }));  
        
      setArticles(enrichedArticles.sort((a, b) \=\> b.relevance\_score \- a.relevance\_score));  
    }  
      
    setLoading(false);  
  };

  const calculateBusinessRelevance \= (article: any): number \=\> {  
    // Logique de scoring basée sur mots-clés business  
    const businessKeywords \= \[  
      'investissement', 'marché', 'économie', 'entreprise', 'startup',  
      'financement', 'projet', 'développement', 'partenariat', 'innovation',  
      'emploi', 'secteur', 'croissance', 'opportunité', 'stratégie'  
    \];  
      
    const text \= \`${article.title} ${article.description}\`.toLowerCase();  
    let score \= 0;  
      
    businessKeywords.forEach(keyword \=\> {  
      if (text.includes(keyword)) score \+= 10;  
    });  
      
    return Math.min(score, 100);  
  };

  const toggleArticleSelection \= (article: Article) \=\> {  
    if (selectedArticles.find(a \=\> a.id \=== article.id)) {  
      setSelectedArticles(prev \=\> prev.filter(a \=\> a.id \!== article.id));  
    } else if (selectedArticles.length \< maxSelection) {  
      setSelectedArticles(prev \=\> \[...prev, article\]);  
    }  
  };

  const handleAnalyze \= () \=\> {  
    if (selectedArticles.length \> 0\) {  
      onSelectionComplete(selectedArticles);  
    }  
  };

  return (  
    \<div className="max-w-6xl mx-auto p-6"\>  
      {/\* Header \*/}  
      \<div className="mb-8"\>  
        \<h2 className="text-3xl font-bold mb-2 flex items-center gap-3"\>  
          \<TrendingUp className="w-8 h-8 text-orange-500" /\>  
          Transformez l'Actualité en Opportunités  
        \</h2\>  
        \<p className="text-gray-400"\>  
          Sélectionnez jusqu'à {maxSelection} articles pour découvrir des opportunités business cachées  
        \</p\>  
      \</div\>

      {/\* Filtres \*/}  
      \<div className="flex gap-2 mb-6"\>  
        {\['all', 'economic', 'political', 'social'\].map(cat \=\> (  
          \<button  
            key={cat}  
            onClick={() \=\> setFilter(cat as any)}  
            className={\`px-4 py-2 rounded-lg transition-colors ${  
              filter \=== cat   
                ? 'bg-orange-600 text-white'   
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'  
            }\`}  
          \>  
            {cat \=== 'all' ? 'Tous' : cat.charAt(0).toUpperCase() \+ cat.slice(1)}  
          \</button\>  
        ))}  
      \</div\>

      {/\* Articles Grid \*/}  
      \<div className="grid md:grid-cols-2 gap-4 mb-6"\>  
        {articles.map((article, index) \=\> {  
          const isSelected \= selectedArticles.find(a \=\> a.id \=== article.id);  
            
          return (  
            \<motion.div  
              key={article.id}  
              initial={{ opacity: 0, y: 20 }}  
              animate={{ opacity: 1, y: 0 }}  
              transition={{ delay: index \* 0.05 }}  
              onClick={() \=\> toggleArticleSelection(article)}  
              className={\`  
                relative p-4 rounded-xl border-2 cursor-pointer transition-all  
                ${isSelected   
                  ? 'border-orange-500 bg-orange-500/10'   
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'  
                }  
                ${selectedArticles.length \>= maxSelection && \!isSelected   
                  ? 'opacity-50 cursor-not-allowed'   
                  : ''  
                }  
              \`}  
            \>  
              {/\* Selection Indicator \*/}  
              {isSelected && (  
                \<div className="absolute top-3 right-3"\>  
                  \<CheckCircle className="w-6 h-6 text-orange-500" /\>  
                \</div\>  
              )}

              {/\* Relevance Score \*/}  
              {article.relevance\_score \> 50 && (  
                \<div className="absolute top-3 left-3"\>  
                  \<span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full"\>  
                    \<Sparkles className="w-3 h-3" /\>  
                    {article.relevance\_score}% pertinent  
                  \</span\>  
                \</div\>  
              )}

              \<div className="mt-6"\>  
                \<h3 className="font-semibold text-lg mb-2 line-clamp-2"\>  
                  {article.title}  
                \</h3\>  
                \<p className="text-gray-400 text-sm line-clamp-3 mb-3"\>  
                  {article.description}  
                \</p\>  
                \<div className="flex items-center justify-between text-xs text-gray-500"\>  
                  \<span\>{article.source}\</span\>  
                  \<span\>{new Date(article.published\_at).toLocaleTimeString('fr-FR')}\</span\>  
                \</div\>  
              \</div\>  
            \</motion.div\>  
          );  
        })}  
      \</div\>

      {/\* Action Bar \*/}  
      \<div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-lg p-4 rounded-xl border border-gray-700"\>  
        \<div className="flex items-center justify-between"\>  
          \<div className="flex items-center gap-2"\>  
            \<AlertCircle className="w-5 h-5 text-yellow-500" /\>  
            \<span className="text-sm"\>  
              {selectedArticles.length} / {maxSelection} articles sélectionnés  
            \</span\>  
          \</div\>  
            
          \<button  
            onClick={handleAnalyze}  
            disabled={selectedArticles.length \=== 0}  
            className={\`  
              px-6 py-3 rounded-lg font-semibold transition-all  
              ${selectedArticles.length \> 0  
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700'  
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'  
              }  
            \`}  
          \>  
            Analyser les Opportunités  
          \</button\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

## **3\. Questionnaire Intelligent de Profilage**

// components/business/UserProfiler.tsx  
'use client';

import { useState } from 'react';  
import { motion } from 'framer-motion';  
import { User, Briefcase, Target, ArrowRight, ArrowLeft } from 'lucide-react';

interface UserProfile {  
  sector: string;  
  experience: string;  
  budget: string;  
  goals: string\[\];  
  location: string;  
  timeCommitment: string;  
}

interface UserProfilerProps {  
  onComplete: (profile: UserProfile) \=\> void;  
  onBack: () \=\> void;  
}

export default function UserProfiler({ onComplete, onBack }: UserProfilerProps) {  
  const \[step, setStep\] \= useState(1);  
  const \[profile, setProfile\] \= useState\<Partial\<UserProfile\>\>({});

  const questions \= \[  
    {  
      id: 'sector',  
      question: 'Dans quel secteur souhaitez-vous entreprendre ?',  
      type: 'select',  
      options: \[  
        { value: 'tech', label: '🚀 Tech & Digital', description: 'Apps, e-commerce, SaaS' },  
        { value: 'service', label: '🤝 Services', description: 'Consulting, formation, B2B' },  
        { value: 'commerce', label: '🛍️ Commerce', description: 'Import/export, distribution' },  
        { value: 'agri', label: '🌱 Agriculture', description: 'Agribusiness, transformation' },  
        { value: 'industry', label: '🏭 Industrie', description: 'Production, manufacture' },  
        { value: 'energy', label: '⚡ Énergie', description: 'Renouvelable, services' },  
        { value: 'realestate', label: '🏗️ Immobilier', description: 'Construction, promotion' },  
        { value: 'other', label: '📋 Autre', description: 'Secteur non listé' }  
      \]  
    },  
    {  
      id: 'experience',  
      question: 'Quel est votre niveau d\\'expérience entrepreneuriale ?',  
      type: 'select',  
      options: \[  
        { value: 'none', label: '🌱 Débutant', description: 'Première entreprise' },  
        { value: 'some', label: '📈 Intermédiaire', description: '1-2 ans d\\'expérience' },  
        { value: 'experienced', label: '💼 Expérimenté', description: '3+ ans ou entreprise existante' },  
        { value: 'serial', label: '🚀 Serial entrepreneur', description: 'Plusieurs entreprises créées' }  
      \]  
    },  
    {  
      id: 'budget',  
      question: 'Quelle est votre capacité d\\'investissement initiale ?',  
      type: 'select',  
      options: \[  
        { value: 'micro', label: '💰 \< 1M XAF', description: 'Micro-entreprise' },  
        { value: 'small', label: '💰💰 1-5M XAF', description: 'Petite entreprise' },  
        { value: 'medium', label: '💰💰💰 5-20M XAF', description: 'PME' },  
        { value: 'large', label: '💰💰💰💰 20M+ XAF', description: 'Projet d\\'envergure' }  
      \]  
    }  
  \];

  const handleNext \= () \=\> {  
    if (step \< questions.length) {  
      setStep(step \+ 1);  
    } else {  
      // Compléter avec des valeurs par défaut  
      const finalProfile: UserProfile \= {  
        sector: profile.sector || 'tech',  
        experience: profile.experience || 'some',  
        budget: profile.budget || 'small',  
        goals: \['growth', 'profit'\],  
        location: 'Libreville',  
        timeCommitment: 'fulltime'  
      };  
      onComplete(finalProfile);  
    }  
  };

  const handleAnswer \= (questionId: string, value: string) \=\> {  
    setProfile(prev \=\> ({ ...prev, \[questionId\]: value }));  
    setTimeout(handleNext, 300);  
  };

  const currentQuestion \= questions\[step \- 1\];

  return (  
    \<div className="max-w-2xl mx-auto p-6"\>  
      {/\* Progress Bar \*/}  
      \<div className="mb-8"\>  
        \<div className="flex justify-between items-center mb-2"\>  
          \<span className="text-sm text-gray-400"\>Question {step} sur {questions.length}\</span\>  
          \<span className="text-sm text-gray-400"\>{Math.round((step / questions.length) \* 100)}%\</span\>  
        \</div\>  
        \<div className="h-2 bg-gray-700 rounded-full overflow-hidden"\>  
          \<motion.div   
            className="h-full bg-gradient-to-r from-orange-500 to-red-600"  
            animate={{ width: \`${(step / questions.length) \* 100}%\` }}  
            transition={{ duration: 0.3 }}  
          /\>  
        \</div\>  
      \</div\>

      {/\* Question \*/}  
      \<motion.div  
        key={step}  
        initial={{ opacity: 0, x: 20 }}  
        animate={{ opacity: 1, x: 0 }}  
        exit={{ opacity: 0, x: \-20 }}  
        className="mb-8"  
      \>  
        \<h3 className="text-2xl font-bold mb-8"\>{currentQuestion.question}\</h3\>  
          
        \<div className="grid gap-3"\>  
          {currentQuestion.options.map(option \=\> (  
            \<motion.button  
              key={option.value}  
              whileHover={{ scale: 1.02 }}  
              whileTap={{ scale: 0.98 }}  
              onClick={() \=\> handleAnswer(currentQuestion.id, option.value)}  
              className="p-4 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-orange-500 rounded-xl text-left transition-all"  
            \>  
              \<div className="flex items-start gap-3"\>  
                \<span className="text-2xl"\>{option.label.split(' ')\[0\]}\</span\>  
                \<div\>  
                  \<div className="font-semibold"\>{option.label.substring(option.label.indexOf(' ') \+ 1)}\</div\>  
                  \<div className="text-sm text-gray-400 mt-1"\>{option.description}\</div\>  
                \</div\>  
              \</div\>  
            \</motion.button\>  
          ))}  
        \</div\>  
      \</motion.div\>

      {/\* Navigation \*/}  
      \<div className="flex justify-between"\>  
        \<button  
          onClick={step \=== 1 ? onBack : () \=\> setStep(step \- 1)}  
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"  
        \>  
          \<ArrowLeft className="w-4 h-4" /\>  
          Retour  
        \</button\>  
          
        {profile\[currentQuestion.id\] && (  
          \<button  
            onClick={handleNext}  
            className="flex items-center gap-2 px-4 py-2 text-orange-500 hover:text-orange-400 transition-colors"  
          \>  
            Passer  
            \<ArrowRight className="w-4 h-4" /\>  
          \</button\>  
        )}  
      \</div\>  
    \</div\>  
  );  
}

## **4\. Fonction Netlify pour Analyse IA**

// netlify/functions/analyze-opportunities.ts  
import { Handler } from '@netlify/functions';  
import OpenAI from 'openai';  
import { createClient } from '@supabase/supabase-js';

const openai \= new OpenAI({  
  apiKey: process.env.OPENAI\_API\_KEY,  
});

const supabase \= createClient(  
  process.env.SUPABASE\_URL\!,  
  process.env.SUPABASE\_SERVICE\_KEY\!  
);

export const handler: Handler \= async (event, context) \=\> {  
  if (event.httpMethod \!== 'POST') {  
    return { statusCode: 405, body: 'Method Not Allowed' };  
  }

  try {  
    const { articles, userProfile, userId } \= JSON.parse(event.body || '{}');

    // Vérifier les limites d'utilisation  
    const usageCheck \= await checkUsageLimits(userId);  
    if (\!usageCheck.allowed) {  
      return {  
        statusCode: 429,  
        body: JSON.stringify({ error: usageCheck.message })  
      };  
    }

    // Construire le prompt enrichi  
    const prompt \= buildOpportunityPrompt(articles, userProfile);

    // Appel à GPT-4  
    const completion \= await openai.chat.completions.create({  
      model: "gpt-4-turbo-preview",  
      messages: \[  
        {  
          role: "system",  
          content: \`Tu es un expert en business development spécialisé sur le marché gabonais.   
          Tu analyses l'actualité pour identifier des opportunités business concrètes et réalisables.  
          Tu connais parfaitement l'écosystème entrepreneurial du Gabon, les réglementations locales,  
          et les spécificités culturelles et économiques du pays.  
            
          Contexte économique Gabon:  
          \- PIB: \~20 milliards USD  
          \- Population: 2.3 millions  
          \- Classe moyenne émergente  
          \- Forte dépendance au pétrole (30% PIB)  
          \- Plan de diversification économique en cours  
          \- Zones économiques spéciales actives  
          \- Monnaie: Franc CFA (XAF)  
            
          Tu dois proposer des opportunités:  
          1\. Réalistes et adaptées au contexte local  
          2\. Avec un potentiel de rentabilité clair  
          3\. Tenant compte des ressources disponibles  
          4\. Exploitant les tendances identifiées dans les articles  
          5\. Avec des étapes concrètes de mise en œuvre\`  
        },  
        {  
          role: "user",  
          content: prompt  
        }  
      \],  
      temperature: 0.7,  
      max\_tokens: 2000,  
      response\_format: { type: "json\_object" }  
    });

    const opportunities \= JSON.parse(completion.choices\[0\].message.content || '{}');

    // Enrichir avec des données locales  
    const enrichedOpportunities \= await enrichWithLocalData(opportunities);

    // Sauvegarder l'analyse  
    const { data: analysis, error } \= await supabase  
      .from('opportunity\_analyses')  
      .insert({  
        user\_id: userId,  
        selected\_articles: articles,  
        user\_profile: userProfile,  
        opportunities: enrichedOpportunities,  
        ai\_tokens\_used: completion.usage?.total\_tokens || 0,  
        analysis\_quality: determineQuality(userProfile)  
      })  
      .select()  
      .single();

    if (error) throw error;

    // Tracker l'usage  
    await updateUsageTracking(userId);

    return {  
      statusCode: 200,  
      body: JSON.stringify({  
        analysisId: analysis.id,  
        opportunities: enrichedOpportunities,  
        creditsRemaining: usageCheck.remaining  
      })  
    };

  } catch (error) {  
    console.error('Analysis error:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Erreur lors de l\\'analyse' })  
    };  
  }  
};

function buildOpportunityPrompt(articles: any\[\], profile: any): string {  
  const articlesContext \= articles.map(a \=\>   
    \`Article: ${a.title}\\nRésumé: ${a.description}\\nSource: ${a.source}\`  
  ).join('\\n\\n');

  return \`  
Analyse ces articles d'actualité gabonaise et génère des opportunités business personnalisées.

ARTICLES DU JOUR:  
${articlesContext}

PROFIL UTILISATEUR:  
\- Secteur d'intérêt: ${profile.sector}  
\- Expérience: ${profile.experience}  
\- Budget: ${profile.budget}  
\- Localisation: ${profile.location || 'Libreville'}

MISSION:  
Identifie 3 opportunités business concrètes basées sur ces actualités.

Pour chaque opportunité, fournis:  
1\. Titre accrocheur  
2\. Description détaillée (comment l'actualité crée cette opportunité)  
3\. Marché cible et taille estimée au Gabon  
4\. Investissement initial requis (fourchette en XAF)  
5\. Niveau de difficulté (1-5)  
6\. Temps de mise sur le marché  
7\. Revenus potentiels (mensuel/annuel)  
8\. 5 étapes clés pour démarrer  
9\. Ressources nécessaires (humaines, matérielles, partenaires)  
10\. Risques principaux et mitigation  
11\. Avantages concurrentiels possibles  
12\. Exemples de succès similaires (si existants)

Format de réponse: JSON structuré avec un array "opportunities" contenant ces informations.

Sois créatif mais réaliste. Privilégie les opportunités avec:  
\- Faible barrière à l'entrée pour le budget indiqué  
\- Fort potentiel de croissance  
\- Adaptation au marché gabonais  
\- Possibilité de digitalisation/scale-up  
\`;  
}

async function checkUsageLimits(userId: string): Promise\<{allowed: boolean, message?: string, remaining?: number}\> {  
  // Récupérer le plan de l'utilisateur  
  const { data: subscription } \= await supabase  
    .rpc('get\_user\_subscription\_status', { user\_uuid: userId });

  const today \= new Date().toISOString().split('T')\[0\];  
    
  // Vérifier l'usage du jour  
  const { data: usage } \= await supabase  
    .from('opportunity\_usage')  
    .select('analyses\_count')  
    .eq('user\_id', userId)  
    .eq('date', today)  
    .single();

  const currentUsage \= usage?.analyses\_count || 0;  
    
  // Limites selon le plan  
  const limits \= {  
    free: 1,  
    discovery: 5,  
    pro: \-1 // Illimité  
  };

  const planName \= subscription?.plan\_slug || 'free';  
  const limit \= limits\[planName\] || 1;

  if (limit \=== \-1 || currentUsage \< limit) {  
    return {   
      allowed: true,   
      remaining: limit \=== \-1 ? 999 : limit \- currentUsage \- 1   
    };  
  }

  return {  
    allowed: false,  
    message: \`Limite atteinte (${limit} analyse${limit \> 1 ? 's' : ''}/jour). Passez au plan supérieur pour continuer.\`,  
    remaining: 0  
  };  
}

async function enrichWithLocalData(opportunities: any): Promise\<any\> {  
  // Enrichir avec des données spécifiques au Gabon  
  // (contacts, régulations, statistiques locales, etc.)  
    
  return opportunities.map((opp: any) \=\> ({  
    ...opp,  
    localInsights: {  
      regulations: getRelevantRegulations(opp.sector),  
      competitors: getLocalCompetitors(opp.sector),  
      suppliers: getLocalSuppliers(opp.sector),  
      govSupport: getGovernmentPrograms(opp.sector)  
    }  
  }));  
}

function getRelevantRegulations(sector: string): string\[\] {  
  const regulations \= {  
    tech: \['Code numérique 2023', 'ARCEP licensing'\],  
    commerce: \['Code commerce OHADA', 'Licence import/export'\],  
    agri: \['Code agricole', 'Certifications GABONAISE'\],  
    // ... autres secteurs  
  };  
  return regulations\[sector\] || \[\];  
}

function getLocalCompetitors(sector: string): string\[\] {  
  // Base de données des acteurs locaux par secteur  
  return \[\];  
}

function getLocalSuppliers(sector: string): string\[\] {  
  // Fournisseurs locaux recommandés  
  return \[\];  
}

function getGovernmentPrograms(sector: string): string\[\] {  
  // Programmes de soutien gouvernementaux  
  return \['FAGA', 'Gabon Entrepreneuriat', 'ANPI'\];  
}

async function updateUsageTracking(userId: string): Promise\<void\> {  
  const today \= new Date().toISOString().split('T')\[0\];  
    
  await supabase  
    .from('opportunity\_usage')  
    .upsert({  
      user\_id: userId,  
      date: today,  
      analyses\_count: 1,  
      last

     last\_analysis\_at: new Date().toISOString()  
    }, {  
      onConflict: 'user\_id,date',  
      count: 'exact'  
    });  
}

function determineQuality(profile: any): string {  
  // Déterminer la qualité de l'analyse selon le profil  
  if (profile.budget \=== 'large' || profile.experience \=== 'serial') {  
    return 'premium';  
  } else if (profile.budget \=== 'medium' || profile.experience \=== 'experienced') {  
    return 'detailed';  
  }  
  return 'basic';  
}

## **5\. Component d'Affichage des Opportunités**

// components/business/OpportunityDisplay.tsx  
'use client';

import { useState } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import {   
  TrendingUp, DollarSign, Clock, Target, Users,   
  AlertTriangle, Lightbulb, ChevronDown, ChevronUp,  
  BookOpen, GraduationCap, FileText, Phone, Lock,  
  Sparkles, ArrowRight, Download, Share2  
} from 'lucide-react';  
import { useRouter } from 'next/navigation';

interface Opportunity {  
  id: string;  
  title: string;  
  description: string;  
  marketSize: string;  
  investment: string;  
  difficulty: number;  
  timeToMarket: string;  
  potentialRevenue: string;  
  steps: string\[\];  
  resources: string\[\];  
  risks: { risk: string; mitigation: string }\[\];  
  advantages: string\[\];  
  examples: string\[\];  
  localInsights?: {  
    regulations: string\[\];  
    competitors: string\[\];  
    suppliers: string\[\];  
    govSupport: string\[\];  
  };  
}

interface OpportunityDisplayProps {  
  opportunities: Opportunity\[\];  
  analysisId: string;  
  userPlan: 'free' | 'discovery' | 'pro';  
}

export default function OpportunityDisplay({   
  opportunities,   
  analysisId,  
  userPlan   
}: OpportunityDisplayProps) {  
  const \[expandedOpp, setExpandedOpp\] \= useState\<string | null\>(null);  
  const \[selectedService, setSelectedService\] \= useState\<string | null\>(null);  
  const \[showPaymentModal, setShowPaymentModal\] \= useState(false);  
  const router \= useRouter();

  const services \= \[  
    {  
      id: 'market\_study',  
      title: 'Étude de Marché Complète',  
      price: 50000,  
      description: 'Analyse approfondie du marché, concurrence, et projections financières',  
      deliverables: \[  
        'Analyse SWOT détaillée',  
        'Étude de la concurrence (20+ acteurs)',  
        'Sizing du marché gabonais',  
        'Projections financières 3 ans',  
        'Plan marketing recommandé'  
      \],  
      duration: '7 jours',  
      icon: FileText  
    },  
    {  
      id: 'training',  
      title: 'Formation Entrepreneur 360°',  
      price: 25000,  
      description: 'Programme complet pour lancer votre business au Gabon',  
      deliverables: \[  
        '12 modules vidéo (6h de contenu)',  
        'Templates et outils pratiques',  
        'Accès communauté entrepreneurs',  
        '3 sessions Q\&A live',  
        'Certificat de completion'  
      \],  
      duration: '4 semaines',  
      icon: GraduationCap  
    },  
    {  
      id: 'action\_plan',  
      title: 'Plan d\\'Action Personnalisé',  
      price: 35000,  
      description: 'Roadmap détaillée et accompagnement pour concrétiser l\\'opportunité',  
      deliverables: \[  
        'Plan d\\'action 90 jours',  
        'Budget prévisionnel détaillé',  
        'Liste fournisseurs vérifiés',  
        'Templates documents légaux',  
        '2 sessions de suivi'  
      \],  
      duration: '5 jours',  
      icon: Target  
    },  
    {  
      id: 'consulting',  
      title: 'Consulting 1-to-1',  
      price: 100000,  
      description: 'Accompagnement personnalisé par un expert sectoriel',  
      deliverables: \[  
        '4 sessions de 2h',  
        'Accès WhatsApp direct',  
        'Revue hebdomadaire progress',  
        'Introductions réseau professionnel',  
        'Support 3 mois'  
      \],  
      duration: '3 mois',  
      icon: Phone  
    }  
  \];

  const getDifficultyLabel \= (level: number) \=\> {  
    const labels \= \['Très facile', 'Facile', 'Modéré', 'Difficile', 'Expert'\];  
    return labels\[level \- 1\] || 'Modéré';  
  };

  const getDifficultyColor \= (level: number) \=\> {  
    const colors \= \['text-green-400', 'text-lime-400', 'text-yellow-400', 'text-orange-400', 'text-red-400'\];  
    return colors\[level \- 1\] || 'text-yellow-400';  
  };

  const handleServicePurchase \= (serviceId: string, opportunityId: string) \=\> {  
    setSelectedService(serviceId);  
    setShowPaymentModal(true);  
    // Logique de paiement à implémenter  
  };

  const isFeatureLocked \= (feature: string): boolean \=\> {  
    const lockedFeatures \= {  
      free: \['steps', 'resources', 'risks', 'localInsights'\],  
      discovery: \['localInsights'\],  
      pro: \[\]  
    };  
    return lockedFeatures\[userPlan\]?.includes(feature) || false;  
  };

  return (  
    \<div className="max-w-6xl mx-auto p-6"\>  
      {/\* Header avec Stats \*/}  
      \<div className="mb-8 bg-gradient-to-r from-orange-500/20 to-red-600/20 rounded-2xl p-6 border border-orange-500/30"\>  
        \<div className="flex items-center justify-between"\>  
          \<div\>  
            \<h2 className="text-3xl font-bold mb-2 flex items-center gap-3"\>  
              \<Sparkles className="w-8 h-8 text-orange-500" /\>  
              {opportunities.length} Opportunités Identifiées  
            \</h2\>  
            \<p className="text-gray-300"\>  
              Basées sur l'actualité du jour et votre profil entrepreneur  
            \</p\>  
          \</div\>  
          \<div className="flex gap-3"\>  
            \<button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"\>  
              \<Download className="w-4 h-4" /\>  
              Exporter PDF  
            \</button\>  
            \<button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"\>  
              \<Share2 className="w-4 h-4" /\>  
              Partager  
            \</button\>  
          \</div\>  
        \</div\>  
      \</div\>

      {/\* Opportunities Cards \*/}  
      \<div className="space-y-6"\>  
        {opportunities.map((opp, index) \=\> (  
          \<motion.div  
            key={opp.id}  
            initial={{ opacity: 0, y: 20 }}  
            animate={{ opacity: 1, y: 0 }}  
            transition={{ delay: index \* 0.1 }}  
            className="bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700 overflow-hidden"  
          \>  
            {/\* Card Header \*/}  
            \<div className="p-6"\>  
              \<div className="flex items-start justify-between mb-4"\>  
                \<div className="flex-1"\>  
                  \<div className="flex items-center gap-3 mb-2"\>  
                    \<span className="text-2xl font-bold text-orange-500"\>\#{index \+ 1}\</span\>  
                    \<h3 className="text-xl font-bold"\>{opp.title}\</h3\>  
                  \</div\>  
                  \<p className="text-gray-300"\>{opp.description}\</p\>  
                \</div\>  
                \<button  
                  onClick={() \=\> setExpandedOpp(expandedOpp \=== opp.id ? null : opp.id)}  
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"  
                \>  
                  {expandedOpp \=== opp.id ? \<ChevronUp /\> : \<ChevronDown /\>}  
                \</button\>  
              \</div\>

              {/\* Key Metrics \*/}  
              \<div className="grid grid-cols-2 md:grid-cols-4 gap-4"\>  
                \<div className="bg-gray-700/50 rounded-lg p-3"\>  
                  \<div className="flex items-center gap-2 text-gray-400 text-sm mb-1"\>  
                    \<DollarSign className="w-4 h-4" /\>  
                    Investissement  
                  \</div\>  
                  \<div className="font-semibold"\>{opp.investment}\</div\>  
                \</div\>  
                  
                \<div className="bg-gray-700/50 rounded-lg p-3"\>  
                  \<div className="flex items-center gap-2 text-gray-400 text-sm mb-1"\>  
                    \<Clock className="w-4 h-4" /\>  
                    Time to Market  
                  \</div\>  
                  \<div className="font-semibold"\>{opp.timeToMarket}\</div\>  
                \</div\>  
                  
                \<div className="bg-gray-700/50 rounded-lg p-3"\>  
                  \<div className="flex items-center gap-2 text-gray-400 text-sm mb-1"\>  
                    \<Target className="w-4 h-4" /\>  
                    Difficulté  
                  \</div\>  
                  \<div className={\`font-semibold ${getDifficultyColor(opp.difficulty)}\`}\>  
                    {getDifficultyLabel(opp.difficulty)}  
                  \</div\>  
                \</div\>  
                  
                \<div className="bg-gray-700/50 rounded-lg p-3"\>  
                  \<div className="flex items-center gap-2 text-gray-400 text-sm mb-1"\>  
                    \<TrendingUp className="w-4 h-4" /\>  
                    Revenus potentiels  
                  \</div\>  
                  \<div className="font-semibold text-green-400"\>{opp.potentialRevenue}\</div\>  
                \</div\>  
              \</div\>  
            \</div\>

            {/\* Expanded Content \*/}  
            \<AnimatePresence\>  
              {expandedOpp \=== opp.id && (  
                \<motion.div  
                  initial={{ height: 0, opacity: 0 }}  
                  animate={{ height: 'auto', opacity: 1 }}  
                  exit={{ height: 0, opacity: 0 }}  
                  transition={{ duration: 0.3 }}  
                  className="border-t border-gray-700"  
                \>  
                  \<div className="p-6 space-y-6"\>  
                    {/\* Marché et Avantages \*/}  
                    \<div className="grid md:grid-cols-2 gap-6"\>  
                      \<div\>  
                        \<h4 className="font-semibold mb-3 flex items-center gap-2"\>  
                          \<Users className="w-5 h-5 text-orange-500" /\>  
                          Marché Cible  
                        \</h4\>  
                        \<p className="text-gray-300 bg-gray-700/30 rounded-lg p-3"\>  
                          {opp.marketSize}  
                        \</p\>  
                      \</div\>  
                        
                      \<div\>  
                        \<h4 className="font-semibold mb-3 flex items-center gap-2"\>  
                          \<Lightbulb className="w-5 h-5 text-orange-500" /\>  
                          Avantages Concurrentiels  
                        \</h4\>  
                        \<ul className="space-y-2"\>  
                          {opp.advantages.slice(0, userPlan \=== 'free' ? 2 : undefined).map((adv, i) \=\> (  
                            \<li key={i} className="flex items-start gap-2 text-gray-300"\>  
                              \<span className="text-green-400 mt-1"\>•\</span\>  
                              \<span className="text-sm"\>{adv}\</span\>  
                            \</li\>  
                          ))}  
                        \</ul\>  
                      \</div\>  
                    \</div\>

                    {/\* Étapes de mise en œuvre \*/}  
                    \<div className="relative"\>  
                      {isFeatureLocked('steps') && (  
                        \<div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10"\>  
                          \<div className="text-center"\>  
                            \<Lock className="w-8 h-8 text-orange-500 mx-auto mb-2" /\>  
                            \<p className="font-semibold mb-2"\>Contenu Premium\</p\>  
                            \<button  
                              onClick={() \=\> router.push('/pricing')}  
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm transition-colors"  
                            \>  
                              Débloquer avec Découverte  
                            \</button\>  
                          \</div\>  
                        \</div\>  
                      )}  
                        
                      \<h4 className="font-semibold mb-3"\>📋 Étapes pour Démarrer\</h4\>  
                      \<div className="space-y-2"\>  
                        {opp.steps.map((step, i) \=\> (  
                          \<div key={i} className="flex items-start gap-3 bg-gray-700/30 rounded-lg p-3"\>  
                            \<span className="flex-shrink-0 w-7 h-7 bg-orange-600 rounded-full flex items-center justify-center text-sm font-bold"\>  
                              {i \+ 1}  
                            \</span\>  
                            \<span className="text-gray-300 text-sm"\>{step}\</span\>  
                          \</div\>  
                        ))}  
                      \</div\>  
                    \</div\>

                    {/\* Risques et Mitigation \*/}  
                    \<div className="relative"\>  
                      {isFeatureLocked('risks') && (  
                        \<div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10"\>  
                          \<div className="text-center"\>  
                            \<Lock className="w-8 h-8 text-orange-500 mx-auto mb-2" /\>  
                            \<p className="font-semibold mb-2"\>Analyse des Risques\</p\>  
                            \<button  
                              onClick={() \=\> router.push('/pricing')}  
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm transition-colors"  
                            \>  
                              Accès avec Plan Pro  
                            \</button\>  
                          \</div\>  
                        \</div\>  
                      )}  
                        
                      \<h4 className="font-semibold mb-3 flex items-center gap-2"\>  
                        \<AlertTriangle className="w-5 h-5 text-yellow-500" /\>  
                        Risques et Mitigation  
                      \</h4\>  
                      \<div className="space-y-3"\>  
                        {opp.risks.map((risk, i) \=\> (  
                          \<div key={i} className="bg-gray-700/30 rounded-lg p-3"\>  
                            \<div className="font-medium text-yellow-400 mb-1"\>  
                              Risque: {risk.risk}  
                            \</div\>  
                            \<div className="text-sm text-gray-300"\>  
                              Mitigation: {risk.mitigation}  
                            \</div\>  
                          \</div\>  
                        ))}  
                      \</div\>  
                    \</div\>

                    {/\* Services Premium \*/}  
                    \<div className="border-t border-gray-700 pt-6"\>  
                      \<h4 className="font-semibold mb-4 text-center"\>  
                        🚀 Passez à l'Action avec Nos Services Premium  
                      \</h4\>  
                      \<div className="grid md:grid-cols-2 gap-4"\>  
                        {services.map(service \=\> {  
                          const Icon \= service.icon;  
                          return (  
                            \<motion.div  
                              key={service.id}  
                              whileHover={{ scale: 1.02 }}  
                              className="bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-xl p-4 border border-gray-600 hover:border-orange-500 transition-all cursor-pointer"  
                              onClick={() \=\> handleServicePurchase(service.id, opp.id)}  
                            \>  
                              \<div className="flex items-start gap-3"\>  
                                \<div className="p-2 bg-orange-600/20 rounded-lg"\>  
                                  \<Icon className="w-6 h-6 text-orange-500" /\>  
                                \</div\>  
                                \<div className="flex-1"\>  
                                  \<h5 className="font-semibold mb-1"\>{service.title}\</h5\>  
                                  \<p className="text-sm text-gray-400 mb-2"\>{service.description}\</p\>  
                                  \<div className="flex items-center justify-between"\>  
                                    \<span className="text-2xl font-bold text-orange-500"\>  
                                      {service.price.toLocaleString('fr-FR')} XAF  
                                    \</span\>  
                                    \<span className="text-xs text-gray-400"\>{service.duration}\</span\>  
                                  \</div\>  
                                \</div\>  
                              \</div\>  
                            \</motion.div\>  
                          );  
                        })}  
                      \</div\>  
                    \</div\>  
                  \</div\>  
                \</motion.div\>  
              )}  
            \</AnimatePresence\>  
          \</motion.div\>  
        ))}  
      \</div\>

      {/\* CTA Section \*/}  
      \<div className="mt-12 text-center bg-gradient-to-r from-orange-500/10 to-red-600/10 rounded-2xl p-8 border border-orange-500/30"\>  
        \<h3 className="text-2xl font-bold mb-4"\>  
          Prêt à Transformer ces Opportunités en Réalité ?  
        \</h3\>  
        \<p className="text-gray-300 mb-6 max-w-2xl mx-auto"\>  
          Nos experts sont là pour vous accompagner à chaque étape de votre projet entrepreneurial  
        \</p\>  
        \<div className="flex gap-4 justify-center"\>  
          \<button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg font-semibold transition-all flex items-center gap-2"\>  
            \<Phone className="w-5 h-5" /\>  
            Parler à un Expert  
          \</button\>  
          \<button className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all"\>  
            Voir Plus d'Exemples  
          \</button\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

## **6\. Page Principale du Module Business**

// app/business/page.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { useUser } from '@/hooks/useUser';  
import ArticleSelector from '@/components/business/ArticleSelector';  
import UserProfiler from '@/components/business/UserProfiler';  
import OpportunityDisplay from '@/components/business/OpportunityDisplay';  
import { Loader2 } from 'lucide-react';

export default function BusinessOpportunitiesPage() {  
  const \[step, setStep\] \= useState\<'select' | 'profile' | 'analyze' | 'results'\>('select');  
  const \[selectedArticles, setSelectedArticles\] \= useState\<any\[\]\>(\[\]);  
  const \[userProfile, setUserProfile\] \= useState\<any\>(null);  
  const \[opportunities, setOpportunities\] \= useState\<any\[\]\>(\[\]);  
  const \[analysisId, setAnalysisId\] \= useState\<string\>('');  
  const \[loading, setLoading\] \= useState(false);  
    
  const { user, subscription } \= useUser();

  const handleArticlesSelected \= (articles: any\[\]) \=\> {  
    setSelectedArticles(articles);  
    setStep('profile');  
  };

  const handleProfileComplete \= async (profile: any) \=\> {  
    setUserProfile(profile);  
    setStep('analyze');  
    await analyzeOpportunities(profile);  
  };

  const analyzeOpportunities \= async (profile: any) \=\> {  
    setLoading(true);  
      
    try {  
      const response \= await fetch('/.netlify/functions/analyze-opportunities', {  
        method: 'POST',  
        headers: {  
          'Content-Type': 'application/json',  
        },  
        body: JSON.stringify({  
          articles: selectedArticles,  
          userProfile: profile,  
          userId: user?.id  
        })  
      });

      const data \= await response.json();  
        
      if (response.ok) {  
        setOpportunities(data.opportunities);  
        setAnalysisId(data.analysisId);  
        setStep('results');  
      } else {  
        throw new Error(data.error);  
      }  
    } catch (error) {  
      console.error('Analysis error:', error);  
      // Gérer l'erreur  
    } finally {  
      setLoading(false);  
    }  
  };

  return (  
    \<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white"\>  
      {/\* Progress Indicator \*/}  
      \<div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-lg border-b border-gray-700"\>  
        \<div className="max-w-6xl mx-auto px-6 py-4"\>  
          \<div className="flex items-center justify-between"\>  
            \<h1 className="text-xl font-bold"\>Business Opportunities Generator\</h1\>  
            \<div className="flex items-center gap-4"\>  
              {\['select', 'profile', 'analyze', 'results'\].map((s, i) \=\> (  
                \<div key={s} className="flex items-center"\>  
                  \<div className={\`  
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold  
                    ${step \=== s ? 'bg-orange-600 text-white' :   
                      \['select', 'profile', 'analyze', 'results'\].indexOf(step) \> i   
                        ? 'bg-green-600 text-white'   
                        : 'bg-gray-700 text-gray-400'}  
                  \`}\>  
                    {i \+ 1}  
                  \</div\>  
                  {i \< 3 && (  
                    \<div className={\`w-12 h-0.5 ml-2 ${  
                      \['select', 'profile', 'analyze', 'results'\].indexOf(step) \> i   
                        ? 'bg-green-600'   
                        : 'bg-gray-700'  
                    }\`} /\>  
                  )}  
                \</div\>  
              ))}  
            \</div\>  
          \</div\>  
        \</div\>  
      \</div\>

      {/\* Content \*/}  
      \<div className="py-8"\>  
        {step \=== 'select' && (  
          \<ArticleSelector onSelectionComplete={handleArticlesSelected} /\>  
        )}  
          
        {step \=== 'profile' && (  
          \<UserProfiler   
            onComplete={handleProfileComplete}  
            onBack={() \=\> setStep('select')}  
          /\>  
        )}  
          
        {step \=== 'analyze' && (  
          \<div className="flex flex-col items-center justify-center min-h-\[400px\]"\>  
            \<Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" /\>  
            \<h2 className="text-2xl font-bold mb-2"\>Analyse en cours...\</h2\>  
            \<p className="text-gray-400"\>Notre IA analyse l'actualité et génère vos opportunités\</p\>  
          \</div\>  
        )}  
          
        {step \=== 'results' && opportunities.length \> 0 && (  
          \<OpportunityDisplay   
            opportunities={opportunities}  
            analysisId={analysisId}  
            userPlan={subscription?.plan\_slug || 'free'}  
          /\>  
        )}  
      \</div\>  
    \</div\>  
  );  
}

## **Configuration et Instructions de Déploiement**

### **1\. Variables d'Environnement (.env.local)**

\# OpenAI  
OPENAI\_API\_KEY=your\_openai\_api\_key

\# Supabase  
NEXT\_PUBLIC\_SUPABASE\_URL=your\_supabase\_url  
NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=your\_supabase\_anon\_key  
SUPABASE\_SERVICE\_KEY=your\_supabase\_service\_key

\# Netlify Functions  
NETLIFY\_DEV=true

\# Payment (si intégré)  
STRIPE\_SECRET\_KEY=your\_stripe\_key  
PAYSTACK\_SECRET\_KEY=your\_paystack\_key

\# Analytics  
MIXPANEL\_TOKEN=your\_mixpanel\_token

### **2\. Installation des Dépendances**

npm install openai @netlify/functions  
npm install framer-motion lucide-react  
npm install react-hook-form @hookform/resolvers zod  
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

### **3\. Configuration Netlify (netlify.toml)**

\[build\]  
  command \= "npm run build"  
  functions \= "netlify/functions"  
  publish \= ".next"

\[functions\]  
  node\_bundler \= "esbuild"

\[\[redirects\]\]  
  from \= "/api/\*"  
  to \= "/.netlify/functions/:splat"  
  status \= 200

### **4\. Déploiement**

\# Build local  
npm run build

\# Test functions localement  
netlify dev

\# Déployer  
netlify deploy \--prod

## **Métriques de Succès à Tracker**

1. **Taux de Conversion** : Articles → Analyse → Service Premium  
2. **Qualité des Opportunités** : Score de satisfaction utilisateur  
3. **Revenus Générés** : Par analyse, par utilisateur, par mois  
4. **Engagement** : Nombre d'analyses par utilisateur  
5. **Viralité** : Partages des opportunités générées

Cette architecture complète transforme Gabon 24/7 en une véritable plateforme d'intelligence business, créant de la valeur tangible à partir de l'actualité quotidienne.

