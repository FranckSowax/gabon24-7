# **Module Veille & Alertes Intelligentes pour Gabon 24/7**

## **Contexte du Projet**

Tu es un développeur full-stack expert chargé de créer un système complet de veille et d'alertes intelligentes pour Gabon 24/7. Ce module doit optimiser l'utilisation d'OpenAI en se concentrant sur la génération de keywords et le matching intelligent plutôt que sur les résumés. Le système doit permettre aux utilisateurs de créer des alertes personnalisées et recevoir des notifications pertinentes via un email quotidien et des notifications WhatsApp.

## **Objectifs Techniques**

### **Stack Technique**

* **Frontend** : Next.js 14 avec TypeScript  
* **Backend** : Netlify Functions \+ Supabase Edge Functions  
* **Base de données** : Supabase (PostgreSQL avec pgvector pour similarité)  
* **IA** : OpenAI GPT-4 pour extraction de keywords  
* **Queue** : Supabase Realtime \+ pg\_cron pour scheduling  
* **Notifications** : Brevo (email) \+ Whapi.cloud (WhatsApp)  
* **Cache** : Redis/Upstash pour optimisation

## **Architecture Optimisée**

/app  
  /alerts  
    /page.tsx                    \# Dashboard alertes  
    /create/page.tsx            \# Création d'alertes  
    /manage/page.tsx            \# Gestion des alertes  
    /history/page.tsx           \# Historique notifications  
/components  
  /alerts  
    /AlertCreator.tsx           \# Interface création alertes  
    /AlertCard.tsx              \# Carte alerte individuelle  
    /KeywordBuilder.tsx         \# Constructeur mots-clés intelligent  
    /DeliverySettings.tsx       \# Configuration notifications  
    /AlertPreview.tsx           \# Prévisualisation matches  
/netlify/functions  
  /process-articles.ts          \# Extraction keywords des articles  
  /match-alerts.ts             \# Matching alertes/articles  
  /send-notifications.ts       \# Envoi notifications  
  /generate-digest.ts          \# Génération digest quotidien  
/supabase/functions  
  /keyword-extractor/          \# Edge function extraction keywords  
  /alert-matcher/              \# Edge function matching  
  /notification-scheduler/      \# Scheduler notifications  
/lib  
  /ai  
    /keyword-generator.ts       \# Logique génération keywords  
    /semantic-matcher.ts        \# Matching sémantique  
  /notifications  
    /email-sender.ts           \# SendGrid integration  
    /whatsapp-sender.ts        \# Whapi integration  
  /alerts  
    /alert-engine.ts           \# Moteur d'alertes  
    /scoring.ts                \# Scoring pertinence

## **1\. Schéma Base de Données Optimisé**

\-- Enable extensions  
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  
CREATE EXTENSION IF NOT EXISTS "pg\_trgm"; \-- Pour recherche fuzzy  
CREATE EXTENSION IF NOT EXISTS "vector"; \-- Pour embeddings

\-- Table des articles enrichis avec keywords  
ALTER TABLE feed\_items ADD COLUMN IF NOT EXISTS   
  keywords jsonb DEFAULT '\[\]',  
  keywords\_vector vector(1536), \-- Embedding pour recherche sémantique  
  processed\_for\_alerts boolean DEFAULT false,  
  alert\_score float DEFAULT 0;

\-- Index pour recherche rapide  
CREATE INDEX idx\_feed\_items\_keywords ON feed\_items USING gin(keywords);  
CREATE INDEX idx\_feed\_items\_processed ON feed\_items(processed\_for\_alerts, created\_at);  
CREATE INDEX idx\_feed\_items\_vector ON feed\_items USING ivfflat (keywords\_vector vector\_cosine\_ops);

\-- Table des alertes utilisateurs  
CREATE TABLE user\_alerts (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    user\_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,  
    name text NOT NULL,  
    alert\_type text NOT NULL CHECK (alert\_type IN ('keyword', 'personality', 'sector', 'professional', 'real\_estate', 'career', 'investment')),  
      
    \-- Configuration de l'alerte  
    config jsonb NOT NULL DEFAULT '{}', \-- Configuration spécifique par type  
    keywords text\[\] DEFAULT '{}', \-- Mots-clés principaux  
    excluded\_keywords text\[\] DEFAULT '{}', \-- Mots-clés à exclure  
    semantic\_keywords jsonb DEFAULT '\[\]', \-- Keywords avec scores sémantiques  
      
    \-- Paramètres de matching  
    match\_mode text DEFAULT 'any' CHECK (match\_mode IN ('any', 'all', 'exact', 'semantic')),  
    min\_relevance\_score float DEFAULT 0.5,  
      
    \-- Livraison  
    delivery\_channels jsonb DEFAULT '{"email": true, "whatsapp": false}',  
    delivery\_frequency text DEFAULT 'instant' CHECK (delivery\_frequency IN ('instant', 'hourly', 'daily', 'weekly')),  
    delivery\_time time DEFAULT '08:00:00',  
    timezone text DEFAULT 'Africa/Libreville',  
      
    \-- Limites et statut  
    is\_active boolean DEFAULT true,  
    is\_premium boolean DEFAULT false,  
    max\_alerts\_per\_day integer DEFAULT 10,  
    alerts\_sent\_today integer DEFAULT 0,  
    last\_alert\_at timestamptz,  
      
    \-- Métadonnées  
    created\_at timestamptz DEFAULT now(),  
    updated\_at timestamptz DEFAULT now()  
);

\-- Table des matches d'alertes  
CREATE TABLE alert\_matches (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    alert\_id uuid REFERENCES user\_alerts(id) ON DELETE CASCADE,  
    article\_id uuid REFERENCES feed\_items(id) ON DELETE CASCADE,  
    user\_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,  
      
    \-- Scoring et matching  
    relevance\_score float NOT NULL,  
    matched\_keywords text\[\],  
    match\_reason text,  
      
    \-- Statut de notification  
    notification\_sent boolean DEFAULT false,  
    sent\_via jsonb DEFAULT '{}', \-- {"email": timestamp, "whatsapp": timestamp}  
    clicked boolean DEFAULT false,  
    clicked\_at timestamptz,  
      
    \-- Feedback utilisateur  
    user\_feedback text CHECK (user\_feedback IN ('relevant', 'not\_relevant', 'spam')),  
      
    created\_at timestamptz DEFAULT now()  
);

\-- Table de configuration des types d'alertes  
CREATE TABLE alert\_templates (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    type text NOT NULL UNIQUE,  
    name text NOT NULL,  
    description text,  
    suggested\_keywords jsonb DEFAULT '\[\]',  
    premium\_only boolean DEFAULT false,  
    config\_schema jsonb NOT NULL, \-- JSON Schema pour validation  
    created\_at timestamptz DEFAULT now()  
);

\-- Table de tracking pour limites gratuites  
CREATE TABLE alert\_usage (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    user\_id uuid REFERENCES auth.users(id),  
    date date NOT NULL DEFAULT CURRENT\_DATE,  
    alerts\_created integer DEFAULT 0,  
    notifications\_sent integer DEFAULT 0,  
    whatsapp\_sent integer DEFAULT 0,  
    email\_sent integer DEFAULT 0,  
    UNIQUE(user\_id, date)  
);

\-- Indexes pour performance  
CREATE INDEX idx\_user\_alerts\_active ON user\_alerts(user\_id, is\_active);  
CREATE INDEX idx\_alert\_matches\_pending ON alert\_matches(notification\_sent, created\_at);  
CREATE INDEX idx\_alert\_matches\_user ON alert\_matches(user\_id, created\_at DESC);  
CREATE INDEX idx\_alert\_usage\_user\_date ON alert\_usage(user\_id, date);

\-- Fonction pour extraire les keywords avec OpenAI  
CREATE OR REPLACE FUNCTION extract\_article\_keywords()  
RETURNS trigger AS $$  
BEGIN  
    \-- Marquer l'article pour traitement  
    NEW.processed\_for\_alerts := false;  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

\-- Trigger sur nouveaux articles  
CREATE TRIGGER trigger\_extract\_keywords  
    AFTER INSERT ON feed\_items  
    FOR EACH ROW  
    EXECUTE FUNCTION extract\_article\_keywords();

\-- Fonction pour reset les quotas quotidiens  
CREATE OR REPLACE FUNCTION reset\_daily\_alert\_quotas()  
RETURNS void AS $$  
BEGIN  
    UPDATE user\_alerts SET alerts\_sent\_today \= 0;  
    DELETE FROM alert\_usage WHERE date \< CURRENT\_DATE \- INTERVAL '30 days';  
END;  
$$ LANGUAGE plpgsql;

\-- Scheduler avec pg\_cron (à activer dans Supabase)  
SELECT cron.schedule('reset-alert-quotas', '0 0 \* \* \*', 'SELECT reset\_daily\_alert\_quotas();');

\-- Seed data pour templates d'alertes  
INSERT INTO alert\_templates (type, name, description, suggested\_keywords, premium\_only, config\_schema) VALUES  
('keyword', 'Mots-clés', 'Alertes sur mots-clés spécifiques',   
 '\["actualité", "Gabon", "économie", "politique"\]', false,  
 '{"type": "object", "properties": {"keywords": {"type": "array", "minItems": 1, "maxItems": 10}}}'),

('sector', 'Secteur d''activité', 'Suivre un secteur économique',  
 '{"tech": \["numérique", "startup", "innovation"\], "oil": \["pétrole", "hydrocarbures", "OPEP"\]}', false,  
 '{"type": "object", "properties": {"sector": {"type": "string", "enum": \["tech", "oil", "mining", "agriculture", "finance"\]}}}'),

('professional', 'Alertes Professionnelles', 'Appels d''offres et opportunités',  
 '\["appel d''offres", "marché public", "consultation", "recrutement"\]', true,  
 '{"type": "object", "properties": {"sectors": {"type": "array"}, "min\_amount": {"type": "number"}}}'),

('real\_estate', 'Immobilier', 'Marché immobilier et projets',  
 '\["immobilier", "construction", "terrain", "location", "vente"\]', true,  
 '{"type": "object", "properties": {"zones": {"type": "array"}, "property\_type": {"type": "string"}, "price\_range": {"type": "object"}}}');

## **2\. Service d'Extraction de Keywords avec OpenAI**

// netlify/functions/process-articles.ts  
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
  try {  
    // Récupérer articles non traités  
    const { data: articles, error } \= await supabase  
      .from('feed\_items')  
      .select('id, title, description, content')  
      .eq('processed\_for\_alerts', false)  
      .order('created\_at', { ascending: false })  
      .limit(10);

    if (\!articles || articles.length \=== 0\) {  
      return { statusCode: 200, body: JSON.stringify({ processed: 0 }) };  
    }

    const processedArticles \= await Promise.all(  
      articles.map(async (article) \=\> {  
        try {  
          // Extraction de keywords avec GPT-4  
          const keywords \= await extractKeywords(article);  
            
          // Génération d'embedding pour recherche sémantique  
          const embedding \= await generateEmbedding(keywords.join(' '));  
            
          // Mise à jour de l'article  
          await supabase  
            .from('feed\_items')  
            .update({  
              keywords: keywords,  
              keywords\_vector: embedding,  
              processed\_for\_alerts: true,  
              alert\_score: calculateAlertScore(keywords)  
            })  
            .eq('id', article.id);

          return { id: article.id, keywords };  
        } catch (err) {  
          console.error(\`Error processing article ${article.id}:\`, err);  
          return null;  
        }  
      })  
    );

    // Déclencher le matching d'alertes  
    await triggerAlertMatching(processedArticles.filter(a \=\> a \!== null));

    return {  
      statusCode: 200,  
      body: JSON.stringify({  
        processed: processedArticles.filter(a \=\> a \!== null).length,  
        articles: processedArticles  
      })  
    };  
  } catch (error) {  
    console.error('Processing error:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Processing failed' })  
    };  
  }  
};

async function extractKeywords(article: any): Promise\<string\[\]\> {  
  const prompt \= \`  
Analyse cet article d'actualité gabonaise et extrais les éléments clés pour un système d'alertes.

ARTICLE:  
Titre: ${article.title}  
Description: ${article.description}  
Contenu: ${article.content?.substring(0, 1000)}

MISSION:  
Extrais et génère une liste optimisée de keywords pour le matching d'alertes.

Inclus obligatoirement:  
1\. \*\*Entités nommées\*\* : Personnes, entreprises, organisations, lieux  
2\. \*\*Secteurs concernés\*\* : Pétrole, mines, tech, agriculture, finance, etc.  
3\. \*\*Types d'événements\*\* : Nomination, investissement, projet, réglementation, etc.  
4\. \*\*Mots-clés thématiques\*\* : Concepts clés de l'article  
5\. \*\*Indicateurs économiques\*\* : Si mentionnés (prix, taux, montants)  
6\. \*\*Zones géographiques\*\* : Villes, provinces, régions  
7\. \*\*Catégories d'opportunités\*\* : Appel d'offres, recrutement, formation, etc.

Format de sortie:  
{  
  "primary\_keywords": \["mot1", "mot2", ...\], // 5-10 mots les plus importants  
  "entities": {  
    "people": \["nom1", "nom2"\],  
    "organizations": \["org1", "org2"\],  
    "locations": \["lieu1", "lieu2"\]  
  },  
  "sectors": \["secteur1", "secteur2"\],  
  "event\_types": \["type1", "type2"\],  
  "opportunity\_types": \["opp1", "opp2"\],  
  "amounts": \["1 milliard XAF", "50 millions USD"\],  
  "dates": \["date1", "date2"\]  
}

Sois précis et exhaustif pour maximiser les chances de matching avec les alertes utilisateurs.  
\`;

  const completion \= await openai.chat.completions.create({  
    model: "gpt-4-turbo-preview",  
    messages: \[  
      { role: "system", content: "Tu es un expert en extraction d'entités et keywords pour système d'alertes." },  
      { role: "user", content: prompt }  
    \],  
    temperature: 0.3,  
    max\_tokens: 500,  
    response\_format: { type: "json\_object" }  
  });

  const result \= JSON.parse(completion.choices\[0\].message.content || '{}');  
    
  // Combiner tous les keywords  
  const allKeywords \= \[  
    ...(result.primary\_keywords || \[\]),  
    ...(result.entities?.people || \[\]),  
    ...(result.entities?.organizations || \[\]),  
    ...(result.entities?.locations || \[\]),  
    ...(result.sectors || \[\]),  
    ...(result.event\_types || \[\]),  
    ...(result.opportunity\_types || \[\])  
  \];

  // Déduplications et normalisation  
  return \[...new Set(allKeywords.map(k \=\> k.toLowerCase().trim()))\];  
}

async function generateEmbedding(text: string): Promise\<number\[\]\> {  
  const response \= await openai.embeddings.create({  
    model: "text-embedding-3-small",  
    input: text,  
  });  
    
  return response.data\[0\].embedding;  
}

function calculateAlertScore(keywords: string\[\]): number {  
  // Score basé sur l'importance des keywords  
  const highValueKeywords \= \[  
    'appel d\\'offres', 'marché public', 'investissement', 'financement',  
    'recrutement', 'nomination', 'projet', 'milliard', 'pétrole', 'emploi'  
  \];  
    
  let score \= 0;  
  keywords.forEach(keyword \=\> {  
    if (highValueKeywords.some(hvk \=\> keyword.includes(hvk))) {  
      score \+= 10;  
    } else {  
      score \+= 1;  
    }  
  });  
    
  return Math.min(score, 100);  
}

async function triggerAlertMatching(articles: any\[\]): Promise\<void\> {  
  // Déclencher la fonction de matching  
  const articleIds \= articles.map(a \=\> a.id);  
    
  await fetch('/.netlify/functions/match-alerts', {  
    method: 'POST',  
    headers: { 'Content-Type': 'application/json' },  
    body: JSON.stringify({ articleIds })  
  });  
}

## **3\. Moteur de Matching d'Alertes**

// netlify/functions/match-alerts.ts  
import { Handler } from '@netlify/functions';  
import { createClient } from '@supabase/supabase-js';

const supabase \= createClient(  
  process.env.SUPABASE\_URL\!,  
  process.env.SUPABASE\_SERVICE\_KEY\!  
);

interface Alert {  
  id: string;  
  user\_id: string;  
  alert\_type: string;  
  keywords: string\[\];  
  excluded\_keywords: string\[\];  
  match\_mode: 'any' | 'all' | 'exact' | 'semantic';  
  min\_relevance\_score: number;  
  config: any;  
  is\_premium: boolean;  
  max\_alerts\_per\_day: number;  
  alerts\_sent\_today: number;  
}

export const handler: Handler \= async (event, context) \=\> {  
  try {  
    const { articleIds } \= JSON.parse(event.body || '{}');  
      
    if (\!articleIds || articleIds.length \=== 0\) {  
      return { statusCode: 400, body: 'No articles to process' };  
    }

    // Récupérer les articles avec leurs keywords  
    const { data: articles } \= await supabase  
      .from('feed\_items')  
      .select('\*')  
      .in('id', articleIds);

    if (\!articles) {  
      return { statusCode: 404, body: 'Articles not found' };  
    }

    // Récupérer toutes les alertes actives  
    const { data: alerts } \= await supabase  
      .from('user\_alerts')  
      .select('\*')  
      .eq('is\_active', true)  
      .lt('alerts\_sent\_today', supabase.raw('max\_alerts\_per\_day'));

    if (\!alerts || alerts.length \=== 0\) {  
      return { statusCode: 200, body: JSON.stringify({ matched: 0 }) };  
    }

    // Matcher chaque article avec chaque alerte  
    const matches: any\[\] \= \[\];  
      
    for (const article of articles) {  
      for (const alert of alerts as Alert\[\]) {  
        const matchResult \= await matchArticleWithAlert(article, alert);  
          
        if (matchResult.isMatch) {  
          matches.push({  
            alert\_id: alert.id,  
            article\_id: article.id,  
            user\_id: alert.user\_id,  
            relevance\_score: matchResult.score,  
            matched\_keywords: matchResult.matchedKeywords,  
            match\_reason: matchResult.reason  
          });  
        }  
      }  
    }

    // Sauvegarder les matches  
    if (matches.length \> 0\) {  
      const { error } \= await supabase  
        .from('alert\_matches')  
        .insert(matches);

      if (\!error) {  
        // Déclencher l'envoi des notifications  
        await triggerNotifications(matches);  
      }  
    }

    return {  
      statusCode: 200,  
      body: JSON.stringify({  
        processed: articles.length,  
        alerts\_checked: alerts.length,  
        matches\_found: matches.length  
      })  
    };

  } catch (error) {  
    console.error('Matching error:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Matching failed' })  
    };  
  }  
};

async function matchArticleWithAlert(article: any, alert: Alert): Promise\<{  
  isMatch: boolean;  
  score: number;  
  matchedKeywords: string\[\];  
  reason: string;  
}\> {  
  const articleKeywords \= article.keywords || \[\];  
  let score \= 0;  
  let matchedKeywords: string\[\] \= \[\];  
  let reason \= '';

  // Vérifier les mots-clés exclus  
  if (alert.excluded\_keywords?.length \> 0\) {  
    const hasExcluded \= alert.excluded\_keywords.some(excluded \=\>  
      articleKeywords.some((k: string) \=\> k.includes(excluded.toLowerCase()))  
    );  
    if (hasExcluded) {  
      return { isMatch: false, score: 0, matchedKeywords: \[\], reason: 'Excluded keyword found' };  
    }  
  }

  // Matching selon le mode  
  switch (alert.match\_mode) {  
    case 'all':  
      // Tous les mots-clés doivent être présents  
      const allMatched \= alert.keywords.every(keyword \=\>  
        articleKeywords.some((ak: string) \=\> ak.includes(keyword.toLowerCase()))  
      );  
      if (allMatched) {  
        matchedKeywords \= alert.keywords;  
        score \= 1.0;  
        reason \= 'All keywords matched';  
      }  
      break;

    case 'any':  
      // Au moins un mot-clé doit être présent  
      matchedKeywords \= alert.keywords.filter(keyword \=\>  
        articleKeywords.some((ak: string) \=\> ak.includes(keyword.toLowerCase()))  
      );  
      if (matchedKeywords.length \> 0\) {  
        score \= matchedKeywords.length / alert.keywords.length;  
        reason \= \`${matchedKeywords.length}/${alert.keywords.length} keywords matched\`;  
      }  
      break;

    case 'exact':  
      // Correspondance exacte des mots-clés  
      matchedKeywords \= alert.keywords.filter(keyword \=\>  
        articleKeywords.includes(keyword.toLowerCase())  
      );  
      if (matchedKeywords.length \> 0\) {  
        score \= matchedKeywords.length / alert.keywords.length;  
        reason \= 'Exact keyword match';  
      }  
      break;

    case 'semantic':  
      // Matching sémantique avec embeddings  
      if (article.keywords\_vector && alert.semantic\_keywords) {  
        score \= await calculateSemanticSimilarity(  
          article.keywords\_vector,  
          alert.semantic\_keywords  
        );  
        if (score \> alert.min\_relevance\_score) {  
          matchedKeywords \= alert.keywords;  
          reason \= \`Semantic similarity: ${(score \* 100).toFixed(1)}%\`;  
        }  
      }  
      break;  
  }

  // Matching spécifique par type d'alerte  
  if (alert.alert\_type \!== 'keyword') {  
    const typeMatch \= await matchByAlertType(article, alert);  
    if (typeMatch.isMatch) {  
      score \= Math.max(score, typeMatch.score);  
      matchedKeywords \= \[...new Set(\[...matchedKeywords, ...typeMatch.keywords\])\];  
      reason \= typeMatch.reason || reason;  
    }  
  }

  return {  
    isMatch: score \>= alert.min\_relevance\_score,  
    score,  
    matchedKeywords,  
    reason  
  };  
}

async function matchByAlertType(article: any, alert: Alert): Promise\<{  
  isMatch: boolean;  
  score: number;  
  keywords: string\[\];  
  reason: string;  
}\> {  
  const articleKeywords \= article.keywords || \[\];  
    
  switch (alert.alert\_type) {  
    case 'professional':  
      // Recherche d'appels d'offres et opportunités  
      const professionalKeywords \= \[  
        'appel d\\'offres', 'marché public', 'consultation', 'avis',   
        'soumission', 'candidature', 'recrutement', 'projet'  
      \];  
      const foundPro \= professionalKeywords.filter(pk \=\>  
        articleKeywords.some((ak: string) \=\> ak.includes(pk))  
      );  
        
      if (foundPro.length \> 0 && alert.config?.sectors) {  
        const sectorMatch \= alert.config.sectors.some((sector: string) \=\>  
          articleKeywords.some((ak: string) \=\> ak.includes(sector.toLowerCase()))  
        );  
          
        if (sectorMatch) {  
          return {  
            isMatch: true,  
            score: 0.8,  
            keywords: foundPro,  
            reason: 'Professional opportunity detected'  
          };  
        }  
      }  
      break;

    case 'real\_estate':  
      // Recherche d'annonces immobilières  
      const realEstateKeywords \= \[  
        'immobilier', 'terrain', 'maison', 'appartement', 'bureau',  
        'location', 'vente', 'construction', 'promotion', 'lotissement'  
      \];  
      const foundRE \= realEstateKeywords.filter(rek \=\>  
        articleKeywords.some((ak: string) \=\> ak.includes(rek))  
      );  
        
      if (foundRE.length \> 0 && alert.config?.zones) {  
        const zoneMatch \= alert.config.zones.some((zone: string) \=\>  
          articleKeywords.some((ak: string) \=\> ak.includes(zone.toLowerCase()))  
        );  
          
        if (zoneMatch) {  
          return {  
            isMatch: true,  
            score: 0.75,  
            keywords: foundRE,  
            reason: 'Real estate opportunity in target zone'  
          };  
        }  
      }  
      break;

    case 'career':  
      // Recherche d'offres d'emploi et formations  
      const careerKeywords \= \[  
        'emploi', 'recrutement', 'poste', 'candidature', 'formation',  
        'stage', 'alternance', 'CDI', 'CDD', 'freelance'  
      \];  
      const foundCareer \= careerKeywords.filter(ck \=\>  
        articleKeywords.some((ak: string) \=\> ak.includes(ck))  
      );  
        
      if (foundCareer.length \> 0\) {  
        return {  
          isMatch: true,  
          score: 0.7,  
          keywords: foundCareer,  
          reason: 'Career opportunity detected'  
        };  
      }  
      break;

    case 'investment':  
      // Recherche d'opportunités d'investissement  
      const investmentKeywords \= \[  
        'investissement', 'financement', 'levée de fonds', 'capital',  
        'rendement', 'dividende', 'action', 'obligation', 'placement'  
      \];  
      const foundInv \= investmentKeywords.filter(ik \=\>  
        articleKeywords.some((ak: string) \=\> ak.includes(ik))  
      );  
        
      if (foundInv.length \> 0\) {  
        // Vérifier si des montants sont mentionnés  
        const amounts \= articleKeywords.filter((k: string) \=\>   
          k.includes('million') || k.includes('milliard') || k.includes('XAF') || k.includes('USD')  
        );  
          
        if (amounts.length \> 0\) {  
          return {  
            isMatch: true,  
            score: 0.85,  
            keywords: \[...foundInv, ...amounts\],  
            reason: 'Investment opportunity with amounts'  
          };  
        }  
      }  
      break;  
  }

  return { isMatch: false, score: 0, keywords: \[\], reason: '' };  
}

async function calculateSemanticSimilarity(vector1: number\[\], keywords: any): Promise\<number\> {  
  // Calcul de similarité cosinus simplifié  
  // En production, utiliser pgvector pour une recherche optimisée  
  return 0.75; // Placeholder  
}

async function triggerNotifications(matches: any\[\]): Promise\<void\> {  
  // Grouper les matches par utilisateur  
  const matchesByUser \= matches.reduce((acc, match) \=\> {  
    if (\!acc\[match.user\_id\]) {  
      acc\[match.user\_id\] \= \[\];  
    }  
    acc\[match.user\_id\].push(match);  
    return acc;  
  }, {} as Record\<string, any\[\]\>);

  // Envoyer les notifications  
  for (const \[userId, userMatches\] of Object.entries(matchesByUser)) {  
    await fetch('/.netlify/functions/send-notifications', {  
      method: 'POST',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify({ userId, matches: userMatches })  
    });  
  }  
}

## **4\. Interface de Création d'Alertes**

// components/alerts/AlertCreator.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import {   
  Bell, Plus, Search, Tag, Building, Home, Briefcase,   
  TrendingUp, X, Info, Sparkles, ChevronDown, Save,  
  Mail, MessageSquare  
} from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';  
import { useUser } from '@/hooks/useUser';

interface AlertType {  
  id: string;  
  name: string;  
  icon: any;  
  description: string;  
  premium: boolean;  
  suggestedKeywords: string\[\];  
}

export default function AlertCreator({ onClose, onSuccess }: any) {  
  const \[step, setStep\] \= useState\<'type' | 'config' | 'delivery'\>('type');  
  const \[selectedType, setSelectedType\] \= useState\<string\>('');  
  const \[alertName, setAlertName\] \= useState('');  
  const \[keywords, setKeywords\] \= useState\<string\[\]\>(\[\]);  
  const \[excludedKeywords, setExcludedKeywords\] \= useState\<string\[\]\>(\[\]);  
  const \[currentKeyword, setCurrentKeyword\] \= useState('');  
  const \[matchMode, setMatchMode\] \= useState\<'any' | 'all'\>('any');  
  const \[deliveryChannels, setDeliveryChannels\] \= useState({  
    email: true,  
    whatsapp: false  
  });  
  const \[deliveryFrequency, setDeliveryFrequency\] \= useState('instant');  
  const \[suggestions, setSuggestions\] \= useState\<string\[\]\>(\[\]);  
  const \[loading, setLoading\] \= useState(false);  
    
  const { user, subscription } \= useUser();  
  const isPremium \= subscription?.plan\_slug \!== 'free';

  const alertTypes: AlertType\[\] \= \[  
    {  
      id: 'keyword',  
      name: 'Mots-clés',  
      icon: Tag,  
      description: 'Surveillez des mots-clés spécifiques dans l\\'actualité',  
      premium: false,  
      suggestedKeywords: \['Gabon', 'Libreville', 'économie', 'politique'\]  
    },  
    {  
      id: 'sector',  
      name: 'Secteur d\\'activité',  
      icon: Building,  
      description: 'Suivez un secteur économique complet',  
      premium: false,  
      suggestedKeywords: \['pétrole', 'mines', 'agriculture', 'technologie', 'finance'\]  
    },  
    {  
      id: 'professional',  
      name: 'Opportunités Pro',  
      icon: Briefcase,  
      description: 'Appels d\\'offres, marchés publics, consultations',  
      premium: true,  
      suggestedKeywords: \['appel d\\'offres', 'marché public', 'consultation', 'soumission'\]  
    },  
    {  
      id: 'real\_estate',  
      name: 'Immobilier',  
      icon: Home

// netlify/functions/send-notifications.ts  
import { Handler } from '@netlify/functions';  
import { createClient } from '@supabase/supabase-js';  
import sgMail from '@sendgrid/mail';  
import fetch from 'node-fetch';

sgMail.setApiKey(process.env.SENDGRID\_API\_KEY\!);

const supabase \= createClient(  
  process.env.SUPABASE\_URL\!,  
  process.env.SUPABASE\_SERVICE\_KEY\!  
);

const WHAPI\_API\_KEY \= process.env.WHAPI\_API\_KEY\!;  
const WHAPI\_BASE\_URL \= 'https://api.whapi.cloud/messages';

export const handler: Handler \= async (event, context) \=\> {  
  try {  
    const { userId, matches } \= JSON.parse(event.body || '{}');  
      
    if (\!userId || \!matches || matches.length \=== 0\) {  
      return { statusCode: 400, body: 'Invalid request' };  
    }

    // Récupérer les détails utilisateur et alertes  
    const { data: user } \= await supabase  
      .from('user\_profiles')  
      .select('\*')  
      .eq('id', userId)  
      .single();

    const { data: userAuth } \= await supabase.auth.admin.getUserById(userId);

    if (\!user || \!userAuth) {  
      return { statusCode: 404, body: 'User not found' };  
    }

    // Grouper les matches par alerte  
    const matchesByAlert \= await groupMatchesByAlert(matches);

    // Préparer les notifications  
    const notifications \= await prepareNotifications(matchesByAlert, user, userAuth.user);

    // Envoyer les notifications  
    const results \= await Promise.allSettled(\[  
      ...notifications.email.map(n \=\> sendEmailNotification(n)),  
      ...notifications.whatsapp.map(n \=\> sendWhatsAppNotification(n))  
    \]);

    // Marquer les matches comme notifiés  
    await markMatchesAsNotified(matches, results);

    // Mettre à jour les compteurs  
    await updateUsageCounters(userId, notifications);

    return {  
      statusCode: 200,  
      body: JSON.stringify({  
        sent: {  
          email: notifications.email.length,  
          whatsapp: notifications.whatsapp.length  
        }  
      })  
    };

  } catch (error) {  
    console.error('Notification error:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Failed to send notifications' })  
    };  
  }  
};

async function groupMatchesByAlert(matches: any\[\]): Promise\<Map\<string, any\[\]\>\> {  
  const grouped \= new Map();  
    
  for (const match of matches) {  
    const { data: alert } \= await supabase  
      .from('user\_alerts')  
      .select('\*')  
      .eq('id', match.alert\_id)  
      .single();

    if (alert) {  
      if (\!grouped.has(alert.id)) {  
        grouped.set(alert.id, { alert, matches: \[\] });  
      }  
      grouped.get(alert.id).matches.push(match);  
    }  
  }  
    
  return grouped;  
}

async function prepareNotifications(matchesByAlert: Map\<string, any\>, user: any, authUser: any) {  
  const emailNotifications: any\[\] \= \[\];  
  const whatsappNotifications: any\[\] \= \[\];

  for (const \[alertId, data\] of matchesByAlert) {  
    const { alert, matches } \= data;  
      
    // Récupérer les articles  
    const articleIds \= matches.map((m: any) \=\> m.article\_id);  
    const { data: articles } \= await supabase  
      .from('feed\_items')  
      .select('\*')  
      .in('id', articleIds);

    if (\!articles) continue;

    // Préparer le contenu  
    const content \= {  
      alertName: alert.name,  
      matchCount: matches.length,  
      articles: articles.map((article: any) \=\> ({  
        title: article.title,  
        description: article.description,  
        url: article.url,  
        source: article.source,  
        publishedAt: article.pub\_date,  
        matchedKeywords: matches.find((m: any) \=\> m.article\_id \=== article.id)?.matched\_keywords || \[\]  
      }))  
    };

    // Email notification  
    if (alert.delivery\_channels?.email) {  
      emailNotifications.push({  
        to: authUser.email,  
        alertId,  
        content,  
        frequency: alert.delivery\_frequency  
      });  
    }

    // WhatsApp notification  
    if (alert.delivery\_channels?.whatsapp && user.phone\_number) {  
      whatsappNotifications.push({  
        to: user.phone\_number,  
        alertId,  
        content,  
        frequency: alert.delivery\_frequency  
      });  
    }  
  }

  return { email: emailNotifications, whatsapp: whatsappNotifications };  
}

async function sendEmailNotification(notification: any) {  
  const { to, content, frequency } \= notification;  
    
  // Template HTML  
  const html \= \`  
\<\!DOCTYPE html\>  
\<html\>  
\<head\>  
  \<meta charset="utf-8"\>  
  \<style\>  
    body { font-family: Arial, sans-serif; line-height: 1.6; color: \#333; }  
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }  
    .header { background: linear-gradient(135deg, \#f97316 0%, \#dc2626 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }  
    .content { background: \#f9fafb; padding: 20px; }  
    .article { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid \#f97316; }  
    .keywords { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }  
    .keyword { background: \#fed7aa; color: \#9a3412; padding: 2px 8px; border-radius: 12px; font-size: 12px; }  
    .footer { text-align: center; padding: 20px; color: \#6b7280; font-size: 12px; }  
    .button { display: inline-block; padding: 12px 24px; background: \#f97316; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }  
  \</style\>  
\</head\>  
\<body\>  
  \<div class="container"\>  
    \<div class="header"\>  
      \<h1\>🔔 Alerte: ${content.alertName}\</h1\>  
      \<p\>${content.matchCount} nouvelle${content.matchCount \> 1 ? 's' : ''} correspondance${content.matchCount \> 1 ? 's' : ''}\</p\>  
    \</div\>  
      
    \<div class="content"\>  
      ${content.articles.map((article: any) \=\> \`  
        \<div class="article"\>  
          \<h3\>${article.title}\</h3\>  
          \<p style="color: \#6b7280; font-size: 14px;"\>${article.source} • ${new Date(article.publishedAt).toLocaleDateString('fr-FR')}\</p\>  
          \<p\>${article.description}\</p\>  
          \<div class="keywords"\>  
            ${article.matchedKeywords.map((kw: string) \=\> \`\<span class="keyword"\>${kw}\</span\>\`).join('')}  
          \</div\>  
          \<a href="${article.url}" class="button"\>Lire l'article\</a\>  
        \</div\>  
      \`).join('')}  
    \</div\>  
      
    \<div class="footer"\>  
      \<p\>Vous recevez cet email car vous avez créé une alerte sur Gabon 24/7\</p\>  
      \<p\>\<a href="${process.env.NEXT\_PUBLIC\_APP\_URL}/alerts/manage"\>Gérer mes alertes  
