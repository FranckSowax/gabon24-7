​​**Système de Crédits pour Gabon 24/7**

## **📊 Architecture du Système de Crédits**

### **Calcul de Base avec GPT-4o-mini**

COÛTS RÉELS OpenAI (GPT-4o-mini):  
\- Input: $0.00015 / 1K tokens \= 0.087 XAF / 1K tokens  
\- Output: $0.0006 / 1K tokens \= 0.348 XAF / 1K tokens

PRIX DE VENTE (x20):  
\- Input: 1.74 XAF / 1K tokens  
\- Output: 6.96 XAF / 1K tokens

CONSOMMATION PAR SERVICE:  
\- Opportunité IA: \~3,500 tokens \= 10.5 XAF (coût réel: 0.52 XAF)  
\- Extraction Keywords Alerte: \~500 tokens \= 1.5 XAF (coût réel: 0.075 XAF)  
\- Matching Sémantique: \~200 tokens \= 0.6 XAF (coût réel: 0.03 XAF)

## **💳 Structure de Crédits**

### **Grille Tarifaire**

// Configuration des crédits  
const CREDIT\_CONFIG \= {  
  // Taux de conversion  
  CREDIT\_TO\_XAF: 10, // 1 crédit \= 10 XAF  
  XAF\_TO\_USD: 580,   // 1 USD \= 580 XAF  
    
  // Multiplicateur de marge  
  MARGIN\_MULTIPLIER: 20,  
    
  // Coûts en crédits par service  
  SERVICES\_COST: {  
    // Module Opportunités IA  
    'opportunity\_analysis': 2,        // 20 XAF (\~3,500 tokens)  
    'opportunity\_deep\_analysis': 5,   // 50 XAF (analyse approfondie)  
    'opportunity\_report\_pdf': 10,     // 100 XAF (rapport complet)  
      
    // Module Alertes & Veille  
    'alert\_creation': 1,              // 10 XAF (extraction keywords)  
    'alert\_premium\_matching': 2,      // 20 XAF (matching sémantique)  
    'alert\_daily\_digest': 1,          // 10 XAF par digest  
      
    // Nouveaux services  
    'ai\_summary': 1,                  // 10 XAF (résumé article)  
    'ai\_translation': 2,              // 20 XAF (traduction)  
    'ai\_content\_generation': 3,       // 30 XAF (génération contenu)  
    'market\_research': 15,            // 150 XAF (étude de marché)  
    'competitor\_analysis': 8,         // 80 XAF (analyse concurrence)  
  }  
};

## **🏷️ Packages de Crédits**

### **Offres d'Achat Direct**

| Package | Crédits | Prix XAF | Prix/Crédit | Bonus | Économie |
| ----- | ----- | ----- | ----- | ----- | ----- |
| **Starter** | 100 | 900 | 9 XAF | \+10% | 10% |
| **Growth** | 500 | 4,000 | 8 XAF | \+20% | 20% |
| **Business** | 1,000 | 7,000 | 7 XAF | \+30% | 30% |
| **Enterprise** | 5,000 | 30,000 | 6 XAF | \+40% | 40% |
| **Premium** | 10,000 | 50,000 | 5 XAF | \+50% | 50% |

### **Crédits Inclus dans les Abonnements**

| Plan | Crédits/mois | Valeur | Services inclus |
| ----- | ----- | ----- | ----- |
| **Gratuit** | 5 | 50 XAF | 2 analyses opportunités OU 5 alertes |
| **Découverte** (2,000 XAF) | 100 | 1,000 XAF | 50 analyses OU 100 alertes |
| **Pro** (10,000 XAF) | 500 | 5,000 XAF | 250 analyses OU 500 alertes |
| **Business** (25,000 XAF) | 2,000 | 20,000 XAF | Illimité \+ API |

## **💾 Schéma Base de Données**

\-- Table des crédits utilisateur  
CREATE TABLE user\_credits (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    user\_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,  
      
    \-- Soldes de crédits  
    balance integer NOT NULL DEFAULT 0,  
    bonus\_balance integer DEFAULT 0, \-- Crédits bonus (expirables)  
    lifetime\_earned integer DEFAULT 0,  
    lifetime\_spent integer DEFAULT 0,  
      
    \-- Limites et seuils  
    monthly\_allocation integer DEFAULT 0, \-- Crédits mensuels du plan  
    low\_balance\_threshold integer DEFAULT 10,  
    auto\_recharge\_enabled boolean DEFAULT false,  
    auto\_recharge\_amount integer DEFAULT 100,  
      
    \-- Dates importantes  
    last\_monthly\_credit timestamptz,  
    bonus\_expires\_at timestamptz,  
      
    created\_at timestamptz DEFAULT now(),  
    updated\_at timestamptz DEFAULT now()  
);

\-- Table des transactions de crédits  
CREATE TABLE credit\_transactions (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    user\_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,  
      
    \-- Type de transaction  
    type text NOT NULL CHECK (type IN ('purchase', 'bonus', 'subscription', 'consumption', 'refund', 'transfer', 'expiration')),  
      
    \-- Montants  
    amount integer NOT NULL, \-- Positif pour crédit, négatif pour débit  
    balance\_before integer NOT NULL,  
    balance\_after integer NOT NULL,  
      
    \-- Détails de la transaction  
    service\_name text, \-- Service qui a consommé les crédits  
    service\_details jsonb DEFAULT '{}', \-- Détails spécifiques au service  
    reference\_id text, \-- ID de l'opportunité, alerte, etc.  
      
    \-- Pour les achats  
    payment\_method text,  
    payment\_reference text,  
    amount\_xaf integer,  
      
    \-- Métadonnées  
    description text,  
    metadata jsonb DEFAULT '{}',  
    ip\_address inet,  
    user\_agent text,  
      
    created\_at timestamptz DEFAULT now()  
);

\-- Table des packages de crédits  
CREATE TABLE credit\_packages (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    name text NOT NULL,  
    credits integer NOT NULL,  
    bonus\_credits integer DEFAULT 0,  
    price\_xaf integer NOT NULL,  
      
    \-- Conditions et limites  
    is\_active boolean DEFAULT true,  
    is\_promotional boolean DEFAULT false,  
    valid\_from timestamptz DEFAULT now(),  
    valid\_until timestamptz,  
    max\_purchases\_per\_user integer,  
      
    \-- Display  
    badge\_text text, \-- "BEST VALUE", "POPULAR", etc.  
    description text,  
    features jsonb DEFAULT '\[\]',  
      
    created\_at timestamptz DEFAULT now()  
);

\-- Table de consommation par service  
CREATE TABLE service\_consumption (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    service\_name text NOT NULL UNIQUE,  
    credits\_required integer NOT NULL,  
      
    \-- Limites  
    daily\_limit\_per\_user integer,  
    monthly\_limit\_per\_user integer,  
    requires\_premium boolean DEFAULT false,  
      
    \-- Statistiques  
    total\_uses integer DEFAULT 0,  
    total\_credits\_consumed integer DEFAULT 0,  
      
    \-- Configuration  
    is\_active boolean DEFAULT true,  
    description text,  
      
    created\_at timestamptz DEFAULT now(),  
    updated\_at timestamptz DEFAULT now()  
);

\-- Table de logs de consommation OpenAI  
CREATE TABLE openai\_usage\_logs (  
    id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    user\_id uuid REFERENCES auth.users(id),  
    transaction\_id uuid REFERENCES credit\_transactions(id),  
      
    \-- Détails OpenAI  
    model text NOT NULL,  
    prompt\_tokens integer NOT NULL,  
    completion\_tokens integer NOT NULL,  
    total\_tokens integer NOT NULL,  
      
    \-- Coûts  
    actual\_cost\_usd numeric(10, 6),  
    actual\_cost\_xaf numeric(10, 2),  
    credits\_charged integer NOT NULL,  
    margin\_xaf numeric(10, 2),  
      
    \-- Context  
    service\_name text,  
    function\_name text,  
      
    created\_at timestamptz DEFAULT now()  
);

\-- Indexes  
CREATE INDEX idx\_user\_credits\_user ON user\_credits(user\_id);  
CREATE INDEX idx\_transactions\_user ON credit\_transactions(user\_id, created\_at DESC);  
CREATE INDEX idx\_transactions\_type ON credit\_transactions(type, created\_at DESC);  
CREATE INDEX idx\_openai\_logs\_user ON openai\_usage\_logs(user\_id, created\_at DESC);

\-- Triggers pour mise à jour automatique  
CREATE OR REPLACE FUNCTION update\_user\_credits\_stats()  
RETURNS TRIGGER AS $$  
BEGIN  
    IF NEW.type \= 'consumption' THEN  
        UPDATE user\_credits   
        SET lifetime\_spent \= lifetime\_spent \+ ABS(NEW.amount),  
            updated\_at \= now()  
        WHERE user\_id \= NEW.user\_id;  
    ELSIF NEW.type IN ('purchase', 'bonus', 'subscription') THEN  
        UPDATE user\_credits   
        SET lifetime\_earned \= lifetime\_earned \+ NEW.amount,  
            updated\_at \= now()  
        WHERE user\_id \= NEW.user\_id;  
    END IF;  
    RETURN NEW;  
END;  
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger\_update\_credits\_stats  
    AFTER INSERT ON credit\_transactions  
    FOR EACH ROW  
    EXECUTE FUNCTION update\_user\_credits\_stats();

\-- Fonction pour vérifier et débiter les crédits  
CREATE OR REPLACE FUNCTION consume\_credits(  
    p\_user\_id uuid,  
    p\_service\_name text,  
    p\_amount integer,  
    p\_reference\_id text DEFAULT NULL  
)  
RETURNS jsonb AS $$  
DECLARE  
    v\_current\_balance integer;  
    v\_result jsonb;  
BEGIN  
    \-- Vérifier le solde  
    SELECT balance INTO v\_current\_balance  
    FROM user\_credits  
    WHERE user\_id \= p\_user\_id  
    FOR UPDATE;  
      
    IF v\_current\_balance IS NULL THEN  
        RETURN jsonb\_build\_object(  
            'success', false,  
            'error', 'User credits not initialized'  
        );  
    END IF;  
      
    IF v\_current\_balance \< p\_amount THEN  
        RETURN jsonb\_build\_object(  
            'success', false,  
            'error', 'Insufficient credits',  
            'balance', v\_current\_balance,  
            'required', p\_amount  
        );  
    END IF;  
      
    \-- Débiter les crédits  
    UPDATE user\_credits  
    SET balance \= balance \- p\_amount,  
        updated\_at \= now()  
    WHERE user\_id \= p\_user\_id;  
      
    \-- Enregistrer la transaction  
    INSERT INTO credit\_transactions (  
        user\_id, type, amount, balance\_before, balance\_after,  
        service\_name, reference\_id  
    ) VALUES (  
        p\_user\_id, 'consumption', \-p\_amount, v\_current\_balance,  
        v\_current\_balance \- p\_amount, p\_service\_name, p\_reference\_id  
    );  
      
    RETURN jsonb\_build\_object(  
        'success', true,  
        'balance\_before', v\_current\_balance,  
        'balance\_after', v\_current\_balance \- p\_amount,  
        'consumed', p\_amount  
    );  
END;  
$$ LANGUAGE plpgsql SECURITY DEFINER;

\-- Seed data pour les packages  
INSERT INTO credit\_packages (name, credits, bonus\_credits, price\_xaf, badge\_text, description) VALUES  
('Starter', 100, 10, 900, NULL, 'Parfait pour débuter'),  
('Growth', 500, 100, 4000, 'POPULAIRE', 'Idéal pour les utilisateurs réguliers'),  
('Business', 1000, 300, 7000, 'ÉCONOMIE 30%', 'Pour les professionnels'),  
('Enterprise', 5000, 2000, 30000, 'MEILLEURE VALEUR', 'Solution entreprise'),  
('Premium', 10000, 5000, 50000, 'MEGA DEAL', 'Pack ultime avec 50% de bonus');

\-- Seed data pour les coûts des services  
INSERT INTO service\_consumption (service\_name, credits\_required, description) VALUES  
('opportunity\_analysis', 2, 'Analyse d''opportunité business IA'),  
('opportunity\_deep\_analysis', 5, 'Analyse approfondie avec plan d''action'),  
('opportunity\_report\_pdf', 10, 'Rapport PDF complet avec étude de marché'),  
('alert\_creation', 1, 'Création d''une alerte avec extraction keywords'),  
('alert\_premium\_matching', 2, 'Matching sémantique avancé'),  
('alert\_daily\_digest', 1, 'Digest quotidien personnalisé'),  
('ai\_summary', 1, 'Résumé IA d''article'),  
('ai\_translation', 2, 'Traduction IA'),  
('market\_research', 15, 'Étude de marché complète'),  
('competitor\_analysis', 8, 'Analyse concurrentielle');

## **🎮 Interface de Gestion des Crédits**

// components/credits/CreditDashboard.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { motion } from 'framer-motion';  
import {   
  Coins, TrendingUp, ShoppingCart, AlertCircle,   
  Plus, History, Zap, Gift, CreditCard   
} from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';  
import { useUser } from '@/hooks/useUser';

export default function CreditDashboard() {  
  const \[credits, setCredits\] \= useState({  
    balance: 0,  
    bonus\_balance: 0,  
    lifetime\_earned: 0,  
    lifetime\_spent: 0  
  });  
  const \[packages, setPackages\] \= useState\<any\[\]\>(\[\]);  
  const \[transactions, setTransactions\] \= useState\<any\[\]\>(\[\]);  
  const \[loading, setLoading\] \= useState(true);  
  const \[selectedPackage, setSelectedPackage\] \= useState\<any\>(null);  
    
  const { user } \= useUser();

  useEffect(() \=\> {  
    if (user) {  
      fetchCreditData();  
    }  
  }, \[user\]);

  const fetchCreditData \= async () \=\> {  
    setLoading(true);  
      
    // Récupérer le solde de crédits  
    const { data: creditData } \= await supabase  
      .from('user\_credits')  
      .select('\*')  
      .eq('user\_id', user?.id)  
      .single();  
      
    if (creditData) {  
      setCredits(creditData);  
    }  
      
    // Récupérer les packages disponibles  
    const { data: packagesData } \= await supabase  
      .from('credit\_packages')  
      .select('\*')  
      .eq('is\_active', true)  
      .order('credits', { ascending: true });  
      
    if (packagesData) {  
      setPackages(packagesData);  
    }  
      
    // Récupérer l'historique des transactions  
    const { data: transactionsData } \= await supabase  
      .from('credit\_transactions')  
      .select('\*')  
      .eq('user\_id', user?.id)  
      .order('created\_at', { ascending: false })  
      .limit(10);  
      
    if (transactionsData) {  
      setTransactions(transactionsData);  
    }  
      
    setLoading(false);  
  };

  const handlePurchasePackage \= async (packageId: string) \=\> {  
    const pkg \= packages.find(p \=\> p.id \=== packageId);  
    if (\!pkg) return;  
      
    // Intégrer ici votre système de paiement  
    // Pour l'exemple, on simule un achat réussi  
      
    const { error } \= await supabase.rpc('purchase\_credits', {  
      p\_user\_id: user?.id,  
      p\_package\_id: packageId,  
      p\_payment\_reference: 'DEMO-' \+ Date.now()  
    });  
      
    if (\!error) {  
      await fetchCreditData();  
      // Afficher notification de succès  
    }  
  };

  const getTransactionIcon \= (type: string) \=\> {  
    switch(type) {  
      case 'purchase': return \<CreditCard className="w-4 h-4 text-green-500" /\>;  
      case 'bonus': return \<Gift className="w-4 h-4 text-purple-500" /\>;  
      case 'consumption': return \<Zap className="w-4 h-4 text-orange-500" /\>;  
      case 'subscription': return \<TrendingUp className="w-4 h-4 text-blue-500" /\>;  
      default: return \<Coins className="w-4 h-4" /\>;  
    }  
  };

  if (loading) {  
    return (  
      \<div className="flex items-center justify-center min-h-\[400px\]"\>  
        \<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"\>\</div\>  
      \</div\>  
    );  
  }

  return (  
    \<div className="max-w-7xl mx-auto p-6"\>  
      {/\* Header avec Solde \*/}  
      \<div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-6 mb-8"\>  
        \<div className="flex items-center justify-between"\>  
          \<div\>  
            \<h2 className="text-3xl font-bold text-white mb-2"\>Mes Crédits\</h2\>  
            \<div className="flex items-center gap-6"\>  
              \<div\>  
                \<p className="text-white/80 text-sm"\>Solde principal\</p\>  
                \<p className="text-4xl font-bold text-white"\>  
                  {credits.balance.toLocaleString()}  
                \</p\>  
              \</div\>  
              {credits.bonus\_balance \> 0 && (  
                \<div\>  
                  \<p className="text-white/80 text-sm"\>Bonus\</p\>  
                  \<p className="text-2xl font-semibold text-yellow-300"\>  
                    \+{credits.bonus\_balance.toLocaleString()}  
                  \</p\>  
                \</div\>  
              )}  
            \</div\>  
          \</div\>  
            
          \<div className="text-right"\>  
            \<p className="text-white/80 text-sm mb-1"\>Valeur estimée\</p\>  
            \<p className="text-2xl font-semibold text-white"\>  
              {((credits.balance \+ credits.bonus\_balance) \* 10).toLocaleString()} XAF  
            \</p\>  
          \</div\>  
        \</div\>

        {/\* Alerte solde faible \*/}  
        {credits.balance \< 10 && (  
          \<div className="mt-4 p-3 bg-yellow-500/20 rounded-lg flex items-center gap-2"\>  
            \<AlertCircle className="w-5 h-5 text-yellow-300" /\>  
            \<p className="text-yellow-100 text-sm"\>  
              Solde faible \! Rechargez pour continuer à utiliser nos services IA.  
            \</p\>  
          \</div\>  
        )}  
      \</div\>

      {/\* Packages d'achat \*/}  
      \<div className="mb-8"\>  
        \<h3 className="text-xl font-bold mb-4"\>Acheter des Crédits\</h3\>  
        \<div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4"\>  
          {packages.map(pkg \=\> (  
            \<motion.div  
              key={pkg.id}  
              whileHover={{ scale: 1.05 }}  
              whileTap={{ scale: 0.95 }}  
              onClick={() \=\> setSelectedPackage(pkg)}  
              className={\`  
                relative p-4 rounded-xl border-2 cursor-pointer transition-all  
                ${selectedPackage?.id \=== pkg.id   
                  ? 'border-orange-500 bg-orange-500/10'   
                  : 'border-gray-700 hover:border-gray-600'  
                }  
              \`}  
            \>  
              {pkg.badge\_text && (  
                \<div className="absolute \-top-3 left-1/2 transform \-translate-x-1/2"\>  
                  \<span className="px-2 py-1 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs rounded-full"\>  
                    {pkg.badge\_text}  
                  \</span\>  
                \</div\>  
              )}  
                
              \<div className="text-center"\>  
                \<div className="text-3xl font-bold mb-1"\>  
                  {pkg.credits.toLocaleString()}  
                \</div\>  
                \<div className="text-sm text-gray-400 mb-2"\>crédits\</div\>  
                  
                {pkg.bonus\_credits \> 0 && (  
                  \<div className="text-green-400 text-sm mb-2"\>  
                    \+{pkg.bonus\_credits} bonus  
                  \</div\>  
                )}  
                  
                \<div className="text-xl font-semibold text-orange-500"\>  
                  {pkg.price\_xaf.toLocaleString()} XAF  
                \</div\>  
                  
                \<div className="text-xs text-gray-500 mt-1"\>  
                  {(pkg.price\_xaf / (pkg.credits \+ pkg.bonus\_credits)).toFixed(1)} XAF/crédit  
                \</div\>  
              \</div\>  
            \</motion.div\>  
          ))}  
        \</div\>  
          
        {selectedPackage && (  
          \<div className="mt-4 p-4 bg-gray-800 rounded-lg"\>  
            \<div className="flex items-center justify-between"\>  
              \<div\>  
                \<p className="text-sm text-gray-400"\>Package sélectionné\</p\>  
                \<p className="font-semibold"\>  
                  {selectedPackage.credits \+ selectedPackage.bonus\_credits} crédits pour {selectedPackage.price\_xaf.toLocaleString()} XAF  
                \</p\>  
              \</div\>  
              \<button  
                onClick={() \=\> handlePurchasePackage(selectedPackage.id)}  
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg font-semibold transition-all"  
              \>  
                Acheter Maintenant  
              \</button\>  
            \</div\>  
          \</div\>  
        )}  
      \</div\>

      {/\* Statistiques d'utilisation \*/}  
      \<div className="grid md:grid-cols-4 gap-4 mb-8"\>  
        \<div className="bg-gray-800 rounded-lg p-4"\>  
          \<div className="flex items-center justify-between mb-2"\>  
            \<span className="text-gray-400 text-sm"\>Total gagné\</span\>  
            \<TrendingUp className="w-4 h-4 text-green-500" /\>  
          \</div\>  
          \<p className="text-2xl font-bold"\>{credits.lifetime\_earned.toLocaleString()}\</p\>  
        \</div\>  
          
        \<div className="bg-gray-800 rounded-lg p-4"\>  
          \<div className="flex items-center justify-between mb-2"\>  
            \<span className="text-gray-400 text-sm"\>Total utilisé\</span\>  
            \<Zap className="w-4 h-4 text-orange-500" /\>  
          \</div\>  
          \<p className="text-2xl font-bold"\>{credits.lifetime\_spent.toLocaleString()}\</p\>  
        \</div\>  
          
        \<div className="bg-gray-800 rounded-lg p-4"\>  
          \<div className="flex items-center justify-between mb-2"\>  
            \<span className="text-gray-400 text-sm"\>Économie réalisée\</span\>  
            \<Coins className="w-4 h-4 text-yellow-500" /\>  
          \</div\>  
          \<p className="text-2xl font-bold"\>  
            {Math.round(credits.lifetime\_spent \* 0.95).toLocaleString()} XAF  
          \</p\>  
        \</div\>  
          
        \<div className="bg-gray-800 rounded-lg p-4"\>  
          \<div className="flex items-center justify-between mb-2"\>  
            \<span className="text-gray-400 text-sm"\>Analyses IA\</span\>  
            \<Plus className="w-4 h-4 text-purple-500" /\>  
          \</div\>  
          \<p className="text-2xl font-bold"\>  
            {Math.floor(credits.lifetime\_spent / 2)}  
          \</p\>  
        \</div\>  
      \</div\>

      {/\* Historique des transactions \*/}  
      \<div\>  
        \<h3 className="text-xl font-bold mb-4 flex items-center gap-2"\>  
          \<History className="w-5 h-5" /\>  
          Historique récent  
        \</h3\>  
          
        \<div className="bg-gray-800 rounded-lg overflow-hidden"\>  
          \<table className="w-full"\>  
            \<thead className="bg-gray-900"\>  
              \<tr\>  
                \<th className="px-4 py-3 text-left text-sm font-medium text-gray-400"\>Date\</th\>  
                \<th className="px-4 py-3 text-left text-sm font-medium text-gray-400"\>Type\</th\>  
                \<th className="px-4 py-3 text-left text-sm font-medium text-gray-400"\>Service\</th\>  
                \<th className="px-4 py-3 text-right text-sm font-medium text-gray-400"\>Montant\</th\>  
                \<th className="px-4 py-3 text-right text-sm font-medium text-gray-400"\>Solde\</th\>  
              \</tr\>  
            \</thead\>  
            \<tbody className="divide-y divide-gray-700"\>  
              {transactions.map(tx \=\> (  
                \<tr key={tx.id} className="hover:bg-gray-700/50"\>  
                  \<td className="px-4 py-3 text-sm"\>  
                    {new Date(tx.created\_at).toLocaleDateString('fr-FR')}  
                  \</td\>  
                  \<td className="px-4 py-3"\>  
                    \<div className="flex items-center gap-2"\>  
                      {getTransactionIcon(tx.type)}  
                      \<span className="text-sm capitalize"\>{tx.type}\</span\>  
                    \</div\>  
                  \</td\>  
                  \<td className="px-4 py-3 text-sm"\>  
                    {tx.service\_name || '-'}  
                  \</td\>  
                  \<td className={\`px-4 py-3 text-right font-semibold ${  
                    tx.amount \> 0 ? 'text-green-500' : 'text-red-500'  
                  }\`}\>  
                    {tx.amount \> 0 ? '+' : ''}{tx.amount}  
                  \</td\>  
                  \<td className="px-4 py-3 text-right text-sm"\>  
                    {tx.balance\_after}  
                  \</td\>  
                \</tr\>  
              ))}  
            \</tbody\>  
          \</table\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

## **⚡ Service de Gestion des Crédits**

// lib/credits/creditManager.ts  
import { createClient } from '@supabase/supabase-js';

const supabase \= createClient(  
  process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!,  
  process.env.SUPABASE\_SERVICE\_KEY\!  
);

export class CreditManager {  
  /\*\*  
   \* Vérifie si l'utilisateur a assez de crédits  
   \*/  
  static async checkBalance(userId: string, requiredCredits: number): Promise\<boolean\> {  
    const { data } \= await supabase  
      .from('user\_credits')  
      .select('balance, bonus\_balance')  
      .eq('user\_id', userId)  
      .single();  
      
    if (\!data) return false;  
      
    return (data.balance \+ data.bonus\_balance) \>= requiredCredits;  
  }

  /\*\*  
   \* Consomme des crédits pour un service  
   \*/  
  static async consumeCredits(  
    userId: string,  
    serviceName: string,  
    amount: number,  
    referenceId?: string,  
    metadata?: any  
  ): Promise\<{ success: boolean; error?: string; balance?: number }\> {  
    const { data, error } \= await supabase.rpc('consume\_credits', {  
      p\_user\_id: userId,  
      p\_service\_name: serviceName,  
      p\_amount: amount,  
      p\_reference\_id: referenceId  
    });

    if (error) {  
      return { success: false, error: error.message };  
    }

    // Logger l'usage OpenAI si applicable  
    if (metadata?.openai\_usage) {  
      await this.logOpenAIUsage(userId, data.transaction\_id, metadata.openai\_usage);  
    }

    return data;  
  }

  /\*\*  
   \* Ajoute des crédits bonus  
   \*/  
  static async addBonusCredits(  
    userId: string,  
    amount: number,  
    reason: string,  
    expiresInDays: number \= 30  
  ): Promise\<void\> {  
    const expiresAt \= new Date();  
    expiresAt.setDate(expiresAt.getDate() \+ expiresInDays);

    await supabase.rpc('add\_credits', {  
      p\_user\_id: userId,  
      p\_amount: amount,  
      p\_type: 'bonus',  
      p\_description: reason,  
      p\_expires\_at: expiresAt.toISOString()  
    });  
  }

  /\*\*  
   \* Recharge mensuelle automatique  
   \*/  
  static async processMonthlyAllocation(userId: string, planCredits: number): Promise\<void\> {  
    await supabase.rpc('add\_credits', {  
      p\_user\_id: userId,  
      p\_amount: planCredits,  
      p\_type: 'subscription',  
      p\_description: 'Allocation mensuelle du plan'  
    });  
  }

  /\*\*  
   \* Log usage OpenAI pour tracking  
   \*/  
  private static async logOpenAIUsage(  
    userId: string,  
    transactionId: string,  
    usage: {  
      model: string;  
      prompt\_tokens: number;  
      completion\_tokens: number;  
      total\_tokens: number;  
    }  
  ): Promise\<void\> {  
    const costUSD \= this.calculateOpenAICost(usage);  
    const costXAF \= costUSD \* 580;  
      
    await supabase  
      .from('openai\_usage\_logs')  
      .insert({  
        user\_id: userId,  
        transaction\_id: transactionId,  
        ...usage,  
        actual\_cost\_usd: costUSD,  
        actual\_cost\_xaf: costXAF,  
        margin\_xaf: (usage.total\_tokens / 1000 \* 10\) \- costXAF // Prix de vente \- coût réel

     });  
  }

  /\*\*  
   \* Calcule le coût réel OpenAI  
   \*/  
  private static calculateOpenAICost(usage: {  
    model: string;  
    prompt\_tokens: number;  
    completion\_tokens: number;  
  }): number {  
    const rates: Record\<string, { input: number; output: number }\> \= {  
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },  
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },  
      'gpt-4': { input: 0.03, output: 0.06 }  
    };

    const rate \= rates\[usage.model\] || rates\['gpt-4o-mini'\];  
      
    return (usage.prompt\_tokens / 1000 \* rate.input) \+   
           (usage.completion\_tokens / 1000 \* rate.output);  
  }

  /\*\*  
   \* Obtenir les statistiques d'utilisation  
   \*/  
  static async getUserStats(userId: string): Promise\<any\> {  
    const { data } \= await supabase  
      .from('credit\_transactions')  
      .select('type, amount, service\_name, created\_at')  
      .eq('user\_id', userId)  
      .gte('created\_at', new Date(Date.now() \- 30 \* 24 \* 60 \* 60 \* 1000).toISOString())  
      .order('created\_at', { ascending: false });

    if (\!data) return null;

    const stats \= {  
      last30Days: {  
        totalSpent: 0,  
        totalEarned: 0,  
        byService: {} as Record\<string, number\>,  
        byDay: {} as Record\<string, number\>  
      },  
      topServices: \[\] as any\[\]  
    };

    data.forEach(tx \=\> {  
      if (tx.amount \< 0\) {  
        stats.last30Days.totalSpent \+= Math.abs(tx.amount);  
        if (tx.service\_name) {  
          stats.last30Days.byService\[tx.service\_name\] \=   
            (stats.last30Days.byService\[tx.service\_name\] || 0\) \+ Math.abs(tx.amount);  
        }  
      } else {  
        stats.last30Days.totalEarned \+= tx.amount;  
      }

      const day \= new Date(tx.created\_at).toISOString().split('T')\[0\];  
      stats.last30Days.byDay\[day\] \= (stats.last30Days.byDay\[day\] || 0\) \+ tx.amount;  
    });

    stats.topServices \= Object.entries(stats.last30Days.byService)  
      .sort((\[, a\], \[, b\]) \=\> b \- a)  
      .slice(0, 5\)  
      .map((\[service, amount\]) \=\> ({ service, amount }));

    return stats;  
  }  
}

## **🔌 Intégration dans les Services Existants**

### **Modification du Service Opportunités IA**

// netlify/functions/analyze-opportunities-with-credits.ts  
import { Handler } from '@netlify/functions';  
import OpenAI from 'openai';  
import { CreditManager } from '@/lib/credits/creditManager';

const openai \= new OpenAI({  
  apiKey: process.env.OPENAI\_API\_KEY,  
});

const CREDITS\_REQUIRED \= 2; // 2 crédits \= 20 XAF

export const handler: Handler \= async (event, context) \=\> {  
  try {  
    const { articles, userProfile, userId } \= JSON.parse(event.body || '{}');

    // 1\. Vérifier les crédits  
    const hasCredits \= await CreditManager.checkBalance(userId, CREDITS\_REQUIRED);  
      
    if (\!hasCredits) {  
      return {  
        statusCode: 402, // Payment Required  
        body: JSON.stringify({  
          error: 'Insufficient credits',  
          required: CREDITS\_REQUIRED,  
          message: 'Vous n\\'avez pas assez de crédits pour cette analyse. Veuillez recharger votre compte.'  
        })  
      };  
    }

    // 2\. Effectuer l'analyse OpenAI  
    const completion \= await openai.chat.completions.create({  
      model: "gpt-4o-mini", // Utilisation du modèle économique  
      messages: \[  
        {  
          role: "system",  
          content: "Tu es un expert en business development au Gabon..."  
        },  
        {  
          role: "user",  
          content: buildPrompt(articles, userProfile)  
        }  
      \],  
      temperature: 0.5,  
      max\_tokens: 800,  
      response\_format: { type: "json\_object" }  
    });

    const opportunities \= JSON.parse(completion.choices\[0\].message.content || '{}');  
    const usage \= completion.usage;

    // 3\. Débiter les crédits avec tracking OpenAI  
    const consumeResult \= await CreditManager.consumeCredits(  
      userId,  
      'opportunity\_analysis',  
      CREDITS\_REQUIRED,  
      null,  
      {  
        openai\_usage: {  
          model: 'gpt-4o-mini',  
          prompt\_tokens: usage?.prompt\_tokens || 0,  
          completion\_tokens: usage?.completion\_tokens || 0,  
          total\_tokens: usage?.total\_tokens || 0  
        }  
      }  
    );

    if (\!consumeResult.success) {  
      throw new Error('Failed to consume credits');  
    }

    // 4\. Sauvegarder l'analyse  
    const { data: analysis } \= await supabase  
      .from('opportunity\_analyses')  
      .insert({  
        user\_id: userId,  
        selected\_articles: articles,  
        user\_profile: userProfile,  
        opportunities: opportunities,  
        ai\_tokens\_used: usage?.total\_tokens || 0,  
        credits\_consumed: CREDITS\_REQUIRED  
      })  
      .select()  
      .single();

    return {  
      statusCode: 200,  
      body: JSON.stringify({  
        analysisId: analysis.id,  
        opportunities,  
        creditsRemaining: consumeResult.balance,  
        creditsUsed: CREDITS\_REQUIRED  
      })  
    };

  } catch (error: any) {  
    console.error('Analysis error:', error);  
      
    // Si erreur OpenAI, ne pas débiter les crédits  
    if (error.message?.includes('OpenAI')) {  
      return {  
        statusCode: 503,  
        body: JSON.stringify({  
          error: 'Service temporairement indisponible',  
          message: 'Le service d\\'analyse est momentanément indisponible. Veuillez réessayer.'  
        })  
      };  
    }

    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Erreur lors de l\\'analyse' })  
    };  
  }  
};

### **Modification du Service Alertes**

// netlify/functions/create-alert-with-credits.ts  
import { Handler } from '@netlify/functions';  
import { CreditManager } from '@/lib/credits/creditManager';

const CREDITS\_PER\_ALERT \= 1; // 1 crédit \= 10 XAF

export const handler: Handler \= async (event, context) \=\> {  
  try {  
    const { userId, alertConfig } \= JSON.parse(event.body || '{}');

    // Vérifier si c'est une alerte premium  
    const creditsCost \= alertConfig.alert\_type \=== 'keyword' ? 0 : CREDITS\_PER\_ALERT;  
      
    if (creditsCost \> 0\) {  
      const hasCredits \= await CreditManager.checkBalance(userId, creditsCost);  
        
      if (\!hasCredits) {  
        return {  
          statusCode: 402,  
          body: JSON.stringify({  
            error: 'Insufficient credits',  
            required: creditsCost,  
            message: 'Cette alerte premium nécessite des crédits.'  
          })  
        };  
      }  
    }

    // Créer l'alerte  
    const { data: alert, error } \= await supabase  
      .from('user\_alerts')  
      .insert({  
        user\_id: userId,  
        ...alertConfig,  
        credits\_cost: creditsCost  
      })  
      .select()  
      .single();

    if (error) throw error;

    // Débiter les crédits si nécessaire  
    if (creditsCost \> 0\) {  
      await CreditManager.consumeCredits(  
        userId,  
        'alert\_creation',  
        creditsCost,  
        alert.id  
      );  
    }

    return {  
      statusCode: 200,  
      body: JSON.stringify({  
        alert,  
        creditsUsed: creditsCost  
      })  
    };

  } catch (error) {  
    console.error('Alert creation error:', error);  
    return {  
      statusCode: 500,  
      body: JSON.stringify({ error: 'Erreur lors de la création de l\\'alerte' })  
    };  
  }  
};

## **💳 Composant Widget de Crédits**

// components/credits/CreditWidget.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import { Coins, Plus, TrendingDown, Info } from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';  
import { useUser } from '@/hooks/useUser';  
import { useRouter } from 'next/navigation';

export default function CreditWidget() {  
  const \[credits, setCredits\] \= useState\<number\>(0);  
  const \[showTooltip, setShowTooltip\] \= useState(false);  
  const \[lowBalance, setLowBalance\] \= useState(false);  
  const { user } \= useUser();  
  const router \= useRouter();

  useEffect(() \=\> {  
    if (user) {  
      fetchCredits();  
      subscribeToChanges();  
    }  
  }, \[user\]);

  const fetchCredits \= async () \=\> {  
    const { data } \= await supabase  
      .from('user\_credits')  
      .select('balance, bonus\_balance')  
      .eq('user\_id', user?.id)  
      .single();  
      
    if (data) {  
      const total \= data.balance \+ data.bonus\_balance;  
      setCredits(total);  
      setLowBalance(total \< 10);  
    }  
  };

  const subscribeToChanges \= () \=\> {  
    const subscription \= supabase  
      .channel('credit\_changes')  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'user\_credits',  
          filter: \`user\_id=eq.${user?.id}\`  
        },  
        () \=\> {  
          fetchCredits();  
        }  
      )  
      .subscribe();

    return () \=\> {  
      subscription.unsubscribe();  
    };  
  };

  return (  
    \<div className="relative"\>  
      \<motion.button  
        whileHover={{ scale: 1.05 }}  
        whileTap={{ scale: 0.95 }}  
        onClick={() \=\> router.push('/credits')}  
        onMouseEnter={() \=\> setShowTooltip(true)}  
        onMouseLeave={() \=\> setShowTooltip(false)}  
        className={\`  
          flex items-center gap-2 px-4 py-2 rounded-lg transition-all  
          ${lowBalance   
            ? 'bg-red-500/20 border border-red-500 animate-pulse'   
            : 'bg-gray-800 border border-gray-700 hover:border-orange-500'  
          }  
        \`}  
      \>  
        \<Coins className={\`w-5 h-5 ${lowBalance ? 'text-red-500' : 'text-orange-500'}\`} /\>  
        \<span className="font-semibold"\>{credits.toLocaleString()}\</span\>  
        {lowBalance && \<TrendingDown className="w-4 h-4 text-red-500" /\>}  
        \<div className="w-px h-5 bg-gray-600" /\>  
        \<Plus className="w-4 h-4 text-gray-400 hover:text-white" /\>  
      \</motion.button\>

      \<AnimatePresence\>  
        {showTooltip && (  
          \<motion.div  
            initial={{ opacity: 0, y: 10 }}  
            animate={{ opacity: 1, y: 0 }}  
            exit={{ opacity: 0, y: 10 }}  
            className="absolute top-full mt-2 right-0 w-64 p-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50"  
          \>  
            \<div className="flex items-center gap-2 mb-3"\>  
              \<Info className="w-4 h-4 text-orange-500" /\>  
              \<span className="font-semibold"\>Vos Crédits\</span\>  
            \</div\>  
              
            \<div className="space-y-2 text-sm"\>  
              \<div className="flex justify-between"\>  
                \<span className="text-gray-400"\>Solde actuel:\</span\>  
                \<span className="font-semibold"\>{credits} crédits\</span\>  
              \</div\>  
              \<div className="flex justify-between"\>  
                \<span className="text-gray-400"\>Valeur:\</span\>  
                \<span\>{credits \* 10} XAF\</span\>  
              \</div\>  
                
              \<div className="pt-2 border-t border-gray-700"\>  
                \<p className="text-xs text-gray-500 mb-2"\>  
                  Les crédits sont utilisés pour :  
                \</p\>  
                \<ul className="text-xs space-y-1"\>  
                  \<li\>• Analyses IA (2 crédits)\</li\>  
                  \<li\>• Alertes premium (1 crédit)\</li\>  
                  \<li\>• Rapports détaillés (10 crédits)\</li\>  
                \</ul\>  
              \</div\>  
                
              {lowBalance && (  
                \<div className="pt-2 border-t border-gray-700"\>  
                  \<p className="text-xs text-red-400"\>  
                    ⚠️ Solde faible \! Rechargez maintenant  
                  \</p\>  
                \</div\>  
              )}  
            \</div\>  
              
            \<button  
              onClick={() \=\> router.push('/credits/purchase')}  
              className="w-full mt-3 px-3 py-2 bg-orange-500 hover:bg-orange-600 rounded text-sm font-semibold transition-colors"  
            \>  
              Acheter des crédits  
            \</button\>  
          \</motion.div\>  
        )}  
      \</AnimatePresence\>  
    \</div\>  
  );  
}

## **📊 Dashboard Analytics des Crédits**

// components/credits/CreditAnalytics.tsx  
'use client';

import { useState, useEffect } from 'react';  
import { Line, Bar, Doughnut } from 'react-chartjs-2';  
import { CreditManager } from '@/lib/credits/creditManager';  
import { useUser } from '@/hooks/useUser';

export default function CreditAnalytics() {  
  const \[stats, setStats\] \= useState\<any\>(null);  
  const { user } \= useUser();

  useEffect(() \=\> {  
    if (user) {  
      loadStats();  
    }  
  }, \[user\]);

  const loadStats \= async () \=\> {  
    const data \= await CreditManager.getUserStats(user?.id\!);  
    setStats(data);  
  };

  if (\!stats) return \<div\>Chargement...\</div\>;

  // Configuration des graphiques  
  const consumptionChart \= {  
    labels: Object.keys(stats.last30Days.byDay),  
    datasets: \[{  
      label: 'Consommation quotidienne',  
      data: Object.values(stats.last30Days.byDay),  
      borderColor: 'rgb(249, 115, 22)',  
      backgroundColor: 'rgba(249, 115, 22, 0.1)',  
      tension: 0.4  
    }\]  
  };

  const servicesChart \= {  
    labels: stats.topServices.map((s: any) \=\> s.service),  
    datasets: \[{  
      label: 'Crédits utilisés',  
      data: stats.topServices.map((s: any) \=\> s.amount),  
      backgroundColor: \[  
        'rgba(249, 115, 22, 0.8)',  
        'rgba(220, 38, 38, 0.8)',  
        'rgba(168, 85, 247, 0.8)',  
        'rgba(34, 197, 94, 0.8)',  
        'rgba(59, 130, 246, 0.8)'  
      \]  
    }\]  
  };

  return (  
    \<div className="grid md:grid-cols-2 gap-6"\>  
      \<div className="bg-gray-800 rounded-lg p-6"\>  
        \<h3 className="text-lg font-semibold mb-4"\>Consommation sur 30 jours\</h3\>  
        \<Line data={consumptionChart} options={{  
          responsive: true,  
          plugins: {  
            legend: { display: false }  
          },  
          scales: {  
            y: { beginAtZero: true }  
          }  
        }} /\>  
      \</div\>

      \<div className="bg-gray-800 rounded-lg p-6"\>  
        \<h3 className="text-lg font-semibold mb-4"\>Top Services Utilisés\</h3\>  
        \<Doughnut data={servicesChart} options={{  
          responsive: true,  
          plugins: {  
            legend: { position: 'bottom' }  
          }  
        }} /\>  
      \</div\>

      \<div className="bg-gray-800 rounded-lg p-6 md:col-span-2"\>  
        \<h3 className="text-lg font-semibold mb-4"\>Statistiques détaillées\</h3\>  
        \<div className="grid grid-cols-2 md:grid-cols-4 gap-4"\>  
          \<div\>  
            \<p className="text-gray-400 text-sm"\>Total dépensé (30j)\</p\>  
            \<p className="text-2xl font-bold"\>{stats.last30Days.totalSpent}\</p\>  
            \<p className="text-xs text-gray-500"\>  
              \~{stats.last30Days.totalSpent \* 10} XAF  
            \</p\>  
          \</div\>  
          \<div\>  
            \<p className="text-gray-400 text-sm"\>Total gagné (30j)\</p\>  
            \<p className="text-2xl font-bold text-green-500"\>  
              \+{stats.last30Days.totalEarned}  
            \</p\>  
          \</div\>  
          \<div\>  
            \<p className="text-gray-400 text-sm"\>Moyenne/jour\</p\>  
            \<p className="text-2xl font-bold"\>  
              {Math.round(stats.last30Days.totalSpent / 30)}  
            \</p\>  
          \</div\>  
          \<div\>  
            \<p className="text-gray-400 text-sm"\>Service favori\</p\>  
            \<p className="text-lg font-bold"\>  
              {stats.topServices\[0\]?.service || '-'}  
            \</p\>  
          \</div\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

## **🎁 Système de Récompenses et Bonus**

// lib/credits/rewardSystem.ts  
export class RewardSystem {  
  static async checkAndReward(userId: string, action: string): Promise\<void\> {  
    const rewards: Record\<string, number\> \= {  
      'first\_analysis': 5,           // Première analyse  
      'daily\_login': 1,              // Connexion quotidienne  
      'weekly\_streak': 10,           // 7 jours consécutifs  
      'referral\_signup': 20,         // Parrainage  
      'profile\_complete': 5,         // Profil complété  
      'first\_alert': 3,              // Première alerte créée  
      'share\_opportunity': 2,        // Partage opportunité  
      'feedback\_provided': 5,        // Feedback donné  
      'subscription\_upgrade': 50,    // Upgrade plan  
      'monthly\_active': 15          // Actif tout le mois  
    };

    const creditReward \= rewards\[action\];  
    if (creditReward) {  
      await CreditManager.addBonusCredits(  
        userId,  
        creditReward,  
        \`Récompense: ${action}\`,  
        30  
      );  
    }  
  }  
}

## **📱 Notifications de Crédits**

// components/credits/CreditNotifications.tsx  
export function useCreditNotifications() {  
  const { user } \= useUser();  
    
  useEffect(() \=\> {  
    if (\!user) return;

    const checkLowBalance \= async () \=\> {  
      const { data } \= await supabase  
        .from('user\_credits')  
        .select('balance')  
        .eq('user\_id', user.id)  
        .single();

      if (data && data.balance \< 5\) {  
        showNotification({  
          type: 'warning',  
          title: 'Crédits faibles',  
          message: \`Il vous reste seulement ${data.balance} crédits. Rechargez pour continuer à utiliser nos services.\`,  
          action: {  
            label: 'Recharger',  
            onClick: () \=\> router.push('/credits/purchase')  
          }  
        });  
      }  
    };

    checkLowBalance();  
    const interval \= setInterval(checkLowBalance, 60000); // Check every minute

    return () \=\> clearInterval(interval);  
  }, \[user\]);  
}

Ce système de crédits complet permet :

1. **Monétisation flexible** avec marge x20 sur les coûts OpenAI  
2. **Tracking précis** de la consommation par service  
3. **Packages attractifs** avec bonus progressifs  
4. **Interface intuitive** pour achat et suivi  
5. **Système de récompenses** pour fidélisation  
6. **Analytics détaillées** pour optimisation  
7. **Notifications intelligentes** pour conversion

Le système est conçu pour être transparent, équitable et incitatif, encourageant l'utilisation tout en maintenant une rentabilité élevée.

# **Widget Profil avec Système de Crédits Intégré**

## **🎯 Widget Profil Unifié avec Crédits**

tsx  
*// components/layout/ProfileWidget.tsx*  
'use client';

import { useState, useEffect, useRef } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import {   
  User, LogOut, Settings, CreditCard, ChevronDown,  
  Coins, Plus, TrendingUp, History, AlertCircle,  
  Package, Zap, Gift, ShoppingCart, BarChart  
} from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';  
import { useRouter } from 'next/navigation';  
import Image from 'next/image';

interface UserProfile {  
  id: string;  
  email: string;  
  full\_name: string;  
  avatar\_url?: string;  
  subscription?: {  
    plan\_name: string;  
    status: string;  
  };  
}

interface CreditData {  
  balance: number;  
  bonus\_balance: number;  
  lifetime\_spent: number;  
  monthly\_allocation: number;  
  last\_monthly\_credit?: string;  
}

export default function ProfileWidget() {  
  const \[user, setUser\] \= useState\<UserProfile | null\>(null);  
  const \[credits, setCredits\] \= useState\<CreditData\>({  
    balance: 0,  
    bonus\_balance: 0,  
    lifetime\_spent: 0,  
    monthly\_allocation: 0  
  });  
  const \[isOpen, setIsOpen\] \= useState(false);  
  const \[activeTab, setActiveTab\] \= useState\<'profile' | 'credits' | 'purchase'\>('profile');  
  const \[packages, setPackages\] \= useState\<any\[\]\>(\[\]);  
  const \[recentTransactions, setRecentTransactions\] \= useState\<any\[\]\>(\[\]);  
  const \[loading, setLoading\] \= useState(true);  
    
  const dropdownRef \= useRef\<HTMLDivElement\>(null);  
  const router \= useRouter();

  useEffect(() \=\> {  
    fetchUserData();  
    fetchCreditData();  
      
    *// Fermer le dropdown si on clique ailleurs*  
    const handleClickOutside \= (event: MouseEvent) \=\> {  
      if (dropdownRef.current && \!dropdownRef.current.contains(event.target as Node)) {  
        setIsOpen(false);  
      }  
    };

    document.addEventListener('mousedown', handleClickOutside);  
    return () \=\> document.removeEventListener('mousedown', handleClickOutside);  
  }, \[\]);

  useEffect(() \=\> {  
    *// Subscribe to credit changes*  
    const subscription \= supabase  
      .channel('credit\_updates')  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'user\_credits',  
          filter: \`user\_id=eq.${user?.id}\`  
        },  
        () \=\> {  
          fetchCreditData();  
        }  
      )  
      .subscribe();

    return () \=\> {  
      subscription.unsubscribe();  
    };  
  }, \[user?.id\]);

  const fetchUserData \= async () \=\> {  
    const { data: { user } } \= await supabase.auth.getUser();  
      
    if (user) {  
      const { data: profile } \= await supabase  
        .from('user\_profiles')  
        .select('\*, subscriptions(\*)')  
        .eq('id', user.id)  
        .single();  
        
      setUser({  
        id: user.id,  
        email: user.email\!,  
        full\_name: profile?.full\_name || user.email\!.split('@')\[0\],  
        avatar\_url: profile?.avatar\_url,  
        subscription: profile?.subscriptions?.\[0\]  
      });  
    }  
    setLoading(false);  
  };

  const fetchCreditData \= async () \=\> {  
    if (\!user) return;

    *// Récupérer les crédits*  
    const { data: creditData } \= await supabase  
      .from('user\_credits')  
      .select('\*')  
      .eq('user\_id', user.id)  
      .single();

    if (creditData) {  
      setCredits(creditData);  
    }

    *// Récupérer les packages disponibles*  
    const { data: packagesData } \= await supabase  
      .from('credit\_packages')  
      .select('\*')  
      .eq('is\_active', true)  
      .order('credits', { ascending: true });

    if (packagesData) {  
      setPackages(packagesData);  
    }

    *// Récupérer les transactions récentes*  
    const { data: transactions } \= await supabase  
      .from('credit\_transactions')  
      .select('\*')  
      .eq('user\_id', user.id)  
      .order('created\_at', { ascending: false })  
      .limit(5);

    if (transactions) {  
      setRecentTransactions(transactions);  
    }  
  };

  const handlePurchasePackage \= async (packageId: string) \=\> {  
    const pkg \= packages.find(p \=\> p.id \=== packageId);  
    if (\!pkg) return;

    *// Rediriger vers la page de paiement avec le package sélectionné*  
    router.push(\`/checkout/credits?package=${packageId}\`);  
  };

  const handleSignOut \= async () \=\> {  
    await supabase.auth.signOut();  
    router.push('/auth/signin');  
  };

  const getTotalCredits \= () \=\> credits.balance \+ credits.bonus\_balance;  
    
  const getCreditColor \= () \=\> {  
    const total \= getTotalCredits();  
    if (total \<= 5) return 'text-red-500';  
    if (total \<= 20) return 'text-yellow-500';  
    return 'text-green-500';  
  };

  const getCreditBgColor \= () \=\> {  
    const total \= getTotalCredits();  
    if (total \<= 5) return 'bg-red-500/10 border-red-500/50';  
    if (total \<= 20) return 'bg-yellow-500/10 border-yellow-500/50';  
    return 'bg-green-500/10 border-green-500/50';  
  };

  if (loading) {  
    return (  
      \<div className\="animate-pulse"\>  
        \<div className\="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg"\>  
          \<div className\="w-8 h-8 bg-gray-700 rounded-full"\>\</div\>  
          \<div className\="w-24 h-4 bg-gray-700 rounded"\>\</div\>  
        \</div\>  
      \</div\>  
    );  
  }

  return (  
    \<div className\="relative" ref\={dropdownRef}\>  
      {*/\* Bouton principal \*/*}  
      \<button  
        onClick\={() \=\> setIsOpen(\!isOpen)}  
        className\="flex items-center gap-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors group"  
      \>  
        {*/\* Avatar \*/*}  
        \<div className\="relative"\>  
          {user?.avatar\_url ? (  
            \<Image  
              src\={user.avatar\_url}  
              alt\={user.full\_name}  
              width\={32}  
              height\={32}  
              className\="rounded-full"  
            /\>  
          ) : (  
            \<div className\="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center"\>  
              \<span className\="text-white font-semibold text-sm"\>  
                {user?.full\_name?.\[0\]?.toUpperCase()}  
              \</span\>  
            \</div\>  
          )}  
          {*/\* Indicateur de crédits faibles \*/*}  
          {getTotalCredits() \<= 5 && (  
            \<div className\="absolute \-top-1 \-right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"\>\</div\>  
          )}  
        \</div\>

        {*/\* Infos principales \*/*}  
        \<div className\="flex items-center gap-2"\>  
          \<div className\={\`flex items-center gap-1.5 px-2 py-1 rounded-md border ${getCreditBgColor()}\`}\>  
            \<Coins className\={\`w-4 h-4 ${getCreditColor()}\`} /\>  
            \<span className\={\`font-semibold ${getCreditColor()}\`}\>  
              {getTotalCredits().toLocaleString()}  
            \</span\>  
          \</div\>  
            
          \<ChevronDown className\={\`w-4 h-4 text-gray-400 transition-transform ${  
            isOpen ? 'rotate-180' : ''  
          }\`} /\>  
        \</div\>  
      \</button\>

      {*/\* Dropdown étendu \*/*}  
      \<AnimatePresence\>  
        {isOpen && (  
          \<motion.div  
            initial\={{ opacity: 0, y: \-10, scale: 0.95 }}  
            animate\={{ opacity: 1, y: 0, scale: 1 }}  
            exit\={{ opacity: 0, y: \-10, scale: 0.95 }}  
            transition\={{ duration: 0.15 }}  
            className\="absolute right-0 mt-2 w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50"  
          \>  
            {*/\* Header du dropdown \*/*}  
            \<div className\="p-4 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700"\>  
              \<div className\="flex items-center gap-3"\>  
                {user?.avatar\_url ? (  
                  \<Image  
                    src\={user.avatar\_url}  
                    alt\={user.full\_name}  
                    width\={48}  
                    height\={48}  
                    className\="rounded-full"  
                  /\>  
                ) : (  
                  \<div className\="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center"\>  
                    \<span className\="text-white font-bold text-lg"\>  
                      {user?.full\_name?.\[0\]?.toUpperCase()}  
                    \</span\>  
                  \</div\>  
                )}  
                \<div className\="flex-1"\>  
                  \<p className\="font-semibold"\>{user?.full\_name}\</p\>  
                  \<p className\="text-sm text-gray-400"\>{user?.email}\</p\>  
                \</div\>  
              \</div\>

              {*/\* Tabs \*/*}  
              \<div className\="flex gap-1 mt-4 p-1 bg-gray-800/50 rounded-lg"\>  
                {\[  
                  { id: 'profile', label: 'Profil', icon: User },  
                  { id: 'credits', label: 'Crédits', icon: Coins },  
                  { id: 'purchase', label: 'Acheter', icon: ShoppingCart }  
                \].map((tab) \=\> {  
                  const Icon \= tab.icon;  
                  return (  
                    \<button  
                      key\={tab.id}  
                      onClick\={() \=\> setActiveTab(tab.id as any)}  
                      className\={\`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-all ${  
                        activeTab \=== tab.id  
                          ? 'bg-orange-500 text-white'  
                          : 'hover:bg-gray-700 text-gray-400'  
                      }\`}  
                    \>  
                      \<Icon className\="w-4 h-4" /\>  
                      \<span className\="text-sm font-medium"\>{tab.label}\</span\>  
                    \</button\>  
                  );  
                })}  
              \</div\>  
            \</div\>

            {*/\* Contenu selon l'onglet actif \*/*}  
            \<div className\="max-h-\[400px\] overflow-y-auto"\>  
              {*/\* Onglet Profil \*/*}  
              {activeTab \=== 'profile' && (  
                \<div className\="p-4 space-y-3"\>  
                  \<div className\="flex items-center justify-between p-3 bg-gray-800 rounded-lg"\>  
                    \<div className\="flex items-center gap-2"\>  
                      \<CreditCard className\="w-5 h-5 text-gray-400" /\>  
                      \<span className\="text-sm"\>Plan actuel\</span\>  
                    \</div\>  
                    \<span className\="font-semibold text-orange-500"\>  
                      {user?.subscription?.plan\_name || 'Gratuit'}  
                    \</span\>  
                  \</div\>

                  \<button  
                    onClick\={() \=\> router.push('/account/settings')}  
                    className\="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors"  
                  \>  
                    \<Settings className\="w-5 h-5 text-gray-400" /\>  
                    \<span\>Paramètres du compte\</span\>  
                  \</button\>

                  \<button  
                    onClick\={handleSignOut}  
                    className\="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded-lg transition-colors text-red-400"  
                  \>  
                    \<LogOut className\="w-5 h-5" /\>  
                    \<span\>Déconnexion\</span\>  
                  \</button\>  
                \</div\>  
              )}

              {*/\* Onglet Crédits \*/*}  
              {activeTab \=== 'credits' && (  
                \<div className\="p-4 space-y-4"\>  
                  {*/\* Solde détaillé \*/*}  
                  \<div className\="bg-gray-800 rounded-lg p-4"\>  
                    \<h4 className\="text-sm font-medium text-gray-400 mb-3"\>Solde détaillé\</h4\>  
                    \<div className\="space-y-2"\>  
                      \<div className\="flex justify-between items-center"\>  
                        \<span className\="text-sm"\>Crédits principaux\</span\>  
                        \<span className\="font-semibold"\>{credits.balance}\</span\>  
                      \</div\>  
                      {credits.bonus\_balance \> 0 && (  
                        \<div className\="flex justify-between items-center"\>  
                          \<span className\="text-sm text-yellow-400"\>Crédits bonus\</span\>  
                          \<span className\="font-semibold text-yellow-400"\>  
                            \+{credits.bonus\_balance}  
                          \</span\>  
                        \</div\>  
                      )}  
                      \<div className\="pt-2 border-t border-gray-700"\>  
                        \<div className\="flex justify-between items-center"\>  
                          \<span className\="font-medium"\>Total disponible\</span\>  
                          \<span className\={\`text-xl font-bold ${getCreditColor()}\`}\>  
                            {getTotalCredits()}  
                          \</span\>  
                        \</div\>  
                        \<p className\="text-xs text-gray-500 mt-1"\>  
                          Valeur: {getTotalCredits() \* 10} XAF  
                        \</p\>  
                      \</div\>  
                    \</div\>  
                  \</div\>

                  {*/\* Statistiques \*/*}  
                  \<div className\="grid grid-cols-2 gap-3"\>  
                    \<div className\="bg-gray-800 rounded-lg p-3"\>  
                      \<div className\="flex items-center gap-2 mb-1"\>  
                        \<TrendingUp className\="w-4 h-4 text-green-500" /\>  
                        \<span className\="text-xs text-gray-400"\>Total utilisé\</span\>  
                      \</div\>  
                      \<p className\="font-semibold"\>{credits.lifetime\_spent}\</p\>  
                    \</div\>  
                    \<div className\="bg-gray-800 rounded-lg p-3"\>  
                      \<div className\="flex items-center gap-2 mb-1"\>  
                        \<Gift className\="w-4 h-4 text-purple-500" /\>  
                        \<span className\="text-xs text-gray-400"\>Allocation/mois\</span\>  
                      \</div\>  
                      \<p className\="font-semibold"\>{credits.monthly\_allocation}\</p\>  
                    \</div\>  
                  \</div\>

                  {*/\* Historique récent \*/*}  
                  \<div\>  
                    \<h4 className\="text-sm font-medium text-gray-400 mb-2"\>Dernières transactions\</h4\>  
                    \<div className\="space-y-2"\>  
                      {recentTransactions.map((tx) \=\> (  
                        \<div key\={tx.id} className\="flex items-center justify-between text-sm"\>  
                          \<div className\="flex items-center gap-2"\>  
                            {tx.type \=== 'consumption' ? (  
                              \<Zap className\="w-4 h-4 text-orange-500" /\>  
                            ) : (  
                              \<Plus className\="w-4 h-4 text-green-500" /\>  
                            )}  
                            \<span className\="text-gray-300"\>{tx.service\_name || tx.type}\</span\>  
                          \</div\>  
                          \<span className\={tx.amount \> 0 ? 'text-green-500' : 'text-red-500'}\>  
                            {tx.amount \> 0 ? '+' : ''}{tx.amount}  
                          \</span\>  
                        \</div\>  
                      ))}  
                    \</div\>  
                  \</div\>

                  {*/\* Actions \*/*}  
                  \<div className\="pt-3 border-t border-gray-700"\>  
                    \<button  
                      onClick\={() \=\> router.push('/credits/history')}  
                      className\="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"  
                    \>  
                      \<History className\="w-4 h-4" /\>  
                      \<span\>Voir l'historique complet\</span\>  
                    \</button\>  
                  \</div\>  
                \</div\>  
              )}

              {*/\* Onglet Achat \*/*}  
              {activeTab \=== 'purchase' && (  
                \<div className\="p-4 space-y-3"\>  
                  {*/\* Alerte si crédits faibles \*/*}  
                  {getTotalCredits() \<= 5 && (  
                    \<div className\="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-2"\>  
                      \<AlertCircle className\="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" /\>  
                      \<div\>  
                        \<p className\="text-sm font-medium text-red-400"\>Crédits insuffisants\</p\>  
                        \<p className\="text-xs text-red-400/80 mt-1"\>  
                          Rechargez maintenant pour continuer à utiliser nos services IA  
                        \</p\>  
                      \</div\>  
                    \</div\>  
                  )}

                  {*/\* Packages \*/*}  
                  \<div className\="space-y-2"\>  
                    {packages.slice(0, 4).map((pkg) \=\> (  
                      \<motion.button  
                        key\={pkg.id}  
                        whileHover\={{ scale: 1.02 }}  
                        whileTap\={{ scale: 0.98 }}  
                        onClick\={() \=\> handlePurchasePackage(pkg.id)}  
                        className\="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all border border-gray-700 hover:border-orange-500"  
                      \>  
                        \<div className\="flex items-center justify-between"\>  
                          \<div className\="flex items-center gap-3"\>  
                            \<div className\="p-2 bg-orange-500/20 rounded-lg"\>  
                              \<Package className\="w-5 h-5 text-orange-500" /\>  
                            \</div\>  
                            \<div className\="text-left"\>  
                              \<p className\="font-semibold flex items-center gap-2"\>  
                                {pkg.credits} crédits  
                                {pkg.bonus\_credits \> 0 && (  
                                  \<span className\="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded"\>  
                                    \+{pkg.bonus\_credits} bonus  
                                  \</span\>  
                                )}  
                              \</p\>  
                              \<p className\="text-xs text-gray-400"\>  
                                {(pkg.price\_xaf / (pkg.credits \+ pkg.bonus\_credits)).toFixed(1)} XAF/crédit  
                              \</p\>  
                            \</div\>  
                          \</div\>  
                          \<div className\="text-right"\>  
                            \<p className\="font-bold text-orange-500"\>  
                              {pkg.price\_xaf.toLocaleString()} XAF  
                            \</p\>  
                            {pkg.badge\_text && (  
                              \<p className\="text-xs text-green-400"\>{pkg.badge\_text}\</p\>  
                            )}  
                          \</div\>  
                        \</div\>  
                      \</motion.button\>  
                    ))}  
                  \</div\>

                  {*/\* Voir tous les packages \*/*}  
                  \<button  
                    onClick\={() \=\> router.push('/credits/packages')}  
                    className\="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all"  
                  \>  
                    Voir tous les packages  
                  \</button\>  
                \</div\>  
              )}  
            \</div\>

            {*/\* Footer avec informations \*/*}  
            \<div className\="p-3 bg-gray-800/50 border-t border-gray-700"\>  
              \<div className\="flex items-center justify-between text-xs text-gray-500"\>  
                \<span\>1 crédit \= 10 XAF\</span\>  
                \<span\>Support: support@gabon247.com\</span\>  
              \</div\>  
            \</div\>  
          \</motion.div\>  
        )}  
      \</AnimatePresence\>  
    \</div\>  
  );

}

## **🎨 Version Mobile du Widget**

tsx  
*// components/layout/MobileProfileWidget.tsx*  
'use client';

import { useState, useEffect } from 'react';  
import { motion, AnimatePresence } from 'framer-motion';  
import {   
  Coins, Menu, X, Plus, AlertCircle   
} from 'lucide-react';  
import { supabase } from '@/lib/supabase/client';  
import { useRouter } from 'next/navigation';

export default function MobileProfileWidget() {  
  const \[credits, setCredits\] \= useState(0);  
  const \[isMenuOpen, setIsMenuOpen\] \= useState(false);  
  const \[lowBalance, setLowBalance\] \= useState(false);  
  const router \= useRouter();

  useEffect(() \=\> {  
    fetchCredits();  
  }, \[\]);

  const fetchCredits \= async () \=\> {  
    const { data: { user } } \= await supabase.auth.getUser();  
    if (\!user) return;

    const { data } \= await supabase  
      .from('user\_credits')  
      .select('balance, bonus\_balance')  
      .eq('user\_id', user.id)  
      .single();  
      
    if (data) {  
      const total \= data.balance \+ data.bonus\_balance;  
      setCredits(total);  
      setLowBalance(total \<= 5);  
    }  
  };

  return (  
    \<\>  
      {*/\* Barre fixe en bas pour mobile \*/*}  
      \<div className\="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-3 flex items-center justify-between md:hidden z-40"\>  
        \<button  
          onClick\={() \=\> setIsMenuOpen(true)}  
          className\="p-2 hover:bg-gray-800 rounded-lg"  
        \>  
          \<Menu className\="w-6 h-6" /\>  
        \</button\>

        \<button  
          onClick\={() \=\> router.push('/credits')}  
          className\={\`flex items-center gap-2 px-4 py-2 rounded-lg ${  
            lowBalance   
              ? 'bg-red-500/20 border border-red-500 animate-pulse'   
              : 'bg-gray-800 border border-gray-700'  
          }\`}  
        \>  
          \<Coins className\={\`w-5 h-5 ${lowBalance ? 'text-red-500' : 'text-orange-500'}\`} /\>  
          \<span className\="font-bold"\>{credits}\</span\>  
          {lowBalance && \<AlertCircle className\="w-4 h-4 text-red-500" /\>}  
        \</button\>

        \<button  
          onClick\={() \=\> router.push('/credits/purchase')}  
          className\="p-2 bg-orange-500 hover:bg-orange-600 rounded-lg"  
        \>  
          \<Plus className\="w-6 h-6" /\>  
        \</button\>  
      \</div\>

      {*/\* Menu slide pour mobile \*/*}  
      \<AnimatePresence\>  
        {isMenuOpen && (  
          \<\>  
            {*/\* Overlay \*/*}  
            \<motion.div  
              initial\={{ opacity: 0 }}  
              animate\={{ opacity: 1 }}  
              exit\={{ opacity: 0 }}  
              onClick\={() \=\> setIsMenuOpen(false)}  
              className\="fixed inset-0 bg-black/50 z-50 md:hidden"  
            /\>

            {*/\* Panel \*/*}  
            \<motion.div  
              initial\={{ x: '100%' }}  
              animate\={{ x: 0 }}  
              exit\={{ x: '100%' }}  
              transition\={{ type: 'spring', damping: 25 }}  
              className\="fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-700 z-50 md:hidden overflow-y-auto"  
            \>  
              {*/\* Contenu similaire au widget desktop mais adapté mobile \*/*}  
              \<div className\="p-4"\>  
                \<div className\="flex items-center justify-between mb-6"\>  
                  \<h2 className\="text-xl font-bold"\>Mon Compte\</h2\>  
                  \<button  
                    onClick\={() \=\> setIsMenuOpen(false)}  
                    className\="p-2 hover:bg-gray-800 rounded-lg"  
                  \>  
                    \<X className\="w-5 h-5" /\>  
                  \</button\>  
                \</div\>

                {*/\* Solde de crédits \*/*}  
                \<div className\="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-4 mb-6"\>  
                  \<p className\="text-white/80 text-sm mb-1"\>Solde de crédits\</p\>  
                  \<p className\="text-3xl font-bold text-white"\>{credits}\</p\>  
                  \<p className\="text-white/60 text-xs mt-1"\>  
                    Valeur: {credits \* 10} XAF  
                  \</p\>  
                \</div\>

                {*/\* Actions rapides \*/*}  
                \<div className\="space-y-3"\>  
                  \<button  
                    onClick\={() \=\> {  
                      router.push('/credits/purchase');  
                      setIsMenuOpen(false);  
                    }}  
                    className\="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"  
                  \>  
                    Acheter des crédits  
                  \</button\>

                  \<button  
                    onClick\={() \=\> {  
                      router.push('/credits/history');  
                      setIsMenuOpen(false);  
                    }}  
                    className\="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"  
                  \>  
                    Historique  
                  \</button\>

                  \<button  
                    onClick\={() \=\> {  
                      router.push('/account/settings');  
                      setIsMenuOpen(false);  
                    }}  
                    className\="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"  
                  \>  
                    Paramètres  
                  \</button\>  
                \</div\>  
              \</div\>  
            \</motion.div\>  
          \</\>  
        )}  
      \</AnimatePresence\>  
    \</\>  
  );

}

## **🔄 Hook pour Gestion des Crédits**

tsx  
*// hooks/useCredits.ts*  
import { useState, useEffect, useCallback } from 'react';  
import { supabase } from '@/lib/supabase/client';  
import { useUser } from './useUser';

export function useCredits() {  
  const \[credits, setCredits\] \= useState({  
    balance: 0,  
    bonus\_balance: 0,  
    total: 0,  
    isLow: false,  
    isLoading: true  
  });  
  const { user } \= useUser();

  const fetchCredits \= useCallback(async () \=\> {  
    if (\!user) return;

    const { data } \= await supabase  
      .from('user\_credits')  
      .select('\*')  
      .eq('user\_id', user.id)  
      .single();

    if (data) {  
      const total \= data.balance \+ data.bonus\_balance;  
      setCredits({  
        balance: data.balance,  
        bonus\_balance: data.bonus\_balance,  
        total,  
        isLow: total \<= 5,  
        isLoading: false  
      });  
    }  
  }, \[user\]);

  useEffect(() \=\> {  
    fetchCredits();

    *// Subscribe to real-time updates*  
    const subscription \= supabase  
      .channel('credits\_channel')  
      .on(  
        'postgres\_changes',  
        {  
          event: '\*',  
          schema: 'public',  
          table: 'user\_credits',  
          filter: \`user\_id=eq.${user?.id}\`  
        },  
        fetchCredits  
      )  
      .subscribe();

    return () \=\> {  
      subscription.unsubscribe();  
    };  
  }, \[user, fetchCredits\]);

  const consumeCredits \= async (amount: number, service: string) \=\> {  
    if (\!user) return { success: false, error: 'User not authenticated' };  
      
    if (credits.total \< amount) {  
      return { success: false, error: 'Insufficient credits', required: amount };  
    }

    const { data, error } \= await supabase.rpc('consume\_credits', {  
      p\_user\_id: user.id,  
      p\_service\_name: service,  
      p\_amount: amount  
    });

    if (error) return { success: false, error: error.message };  
      
    await fetchCredits(); *// Refresh credits*  
    return { success: true, data };  
  };

  return {  
    ...credits,  
    refetch: fetchCredits,  
    consume: consumeCredits  
  };

}

## **📊 Mini Dashboard dans le Header**

tsx  
*// components/layout/Header.tsx*  
import ProfileWidget from './ProfileWidget';  
import MobileProfileWidget from './MobileProfileWidget';

export default function Header() {  
  return (  
    \<header className\="sticky top-0 z-40 bg-gray-900 border-b border-gray-700"\>  
      \<div className\="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"\>  
        \<div className\="flex items-center justify-between h-16"\>  
          {*/\* Logo et navigation \*/*}  
          \<div className\="flex items-center"\>  
            \<Link href\="/" className\="flex items-center gap-2"\>  
              \<span className\="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent"\>  
                Gabon 24/7  
              \</span\>  
            \</Link\>  
          \</div\>

          {*/\* Widget Profil avec Crédits (Desktop) \*/*}  
          \<div className\="hidden md:block"\>  
            \<ProfileWidget /\>  
          \</div\>  
        \</div\>  
      \</div\>

      {*/\* Widget Mobile \*/*}  
      \<MobileProfileWidget /\>  
    \</header\>  
  );

}

