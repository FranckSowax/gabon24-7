# Module Opportunités IA Enrichi avec MCP Brave & DeepWiki

## 🎯 Vue d'ensemble

Le module opportunités de Gabon 24/7 a été enrichi avec l'intégration des services **MCP Brave Search** et **MCP DeepWiki** pour fournir des analyses business plus approfondies et factuelles.

## 🏗️ Architecture

### Composants principaux

1. **Client MCP Brave Search** (`/netlify/functions/lib/mcp-brave-client.js`)
   - Recherche de données de marché en temps réel
   - Analyse concurrentielle
   - Informations réglementaires récentes

2. **Client MCP DeepWiki** (`/netlify/functions/lib/mcp-deepwiki-client.js`)  
   - Données démographiques et géographiques
   - Informations sectorielles
   - Cadre réglementaire et juridique

3. **Service d'enrichissement** (`/netlify/functions/lib/opportunity-enricher.js`)
   - Orchestre les appels aux différents MCP
   - Combine et analyse les données collectées
   - Gère les niveaux d'enrichissement (basic/premium)

4. **Fonction d'enrichissement** (`/netlify/functions/enhance-opportunity.js`)
   - Endpoint API pour l'enrichissement à la demande
   - Gestion du cache et des crédits
   - Sauvegarde en base de données

## 🔄 Flux d'enrichissement

### Niveau Basic (Gratuit)
1. **Données factuelles essentielles** via DeepWiki
   - Population, densité (limitées)
   - Infrastructure de base
   - Indicateurs économiques généraux

2. **Recherche de marché basique** via Brave Search
   - Estimation de taille du marché
   - 2 tendances principales
   - 2 segments clients

3. **Limitations**
   - Pas d'analyse concurrentielle
   - Informations réglementaires basiques
   - Message d'upgrade vers premium

### Niveau Premium (Payant - 5 crédits)
1. **Données factuelles complètes** via DeepWiki
   - Démographie détaillée
   - Infrastructure complète
   - Indicateurs économiques approfondis

2. **Recherche de marché approfondie** via Brave Search
   - Taille du marché avec sources
   - Tendances et dynamiques complètes
   - Segments clients détaillés

3. **Analyse concurrentielle** via Brave Search
   - Concurrents directs et indirects
   - Gaps de marché identifiés
   - Paysage concurrentiel

4. **Informations réglementaires** via DeepWiki + Brave
   - Licences requises détaillées
   - Réglementations spécifiques
   - Programmes gouvernementaux

5. **Recommandations actionnables**
   - Actions prioritaires
   - Avantages concurrentiels suggérés
   - Timeline d'implémentation

## 🚀 Intégration automatique

### Enrichissement léger automatique
Toutes les analyses d'opportunités (`analyze-opportunity.js`) incluent désormais automatiquement :
- Un enrichissement basic gratuit
- Données factuelles de base via MCP
- Sauvegarde des données enrichies en BDD

### Enrichissement à la demande
- Endpoint `/enhance-opportunity` pour enrichissement complet
- Support des niveaux basic et premium
- Cache intelligent (7 jours pour éviter les requêtes répétées)

## 🗄️ Structure de base de données

### Tables ajoutées/modifiées

1. **opportunity_analyses** (enrichie)
   ```sql
   enrichment_data jsonb
   factual_data jsonb  
   market_research jsonb
   competitor_analysis jsonb
   regulatory_info jsonb
   enrichment_status text
   enrichment_level text
   confidence_score float
   ```

2. **enrichment_cache** (nouvelle)
   - Cache des recherches MCP
   - TTL de 7-30 jours selon le type
   - Optimisation des performances

3. **enrichment_metrics** (nouvelle)
   - Métriques de performance
   - Tracking des crédits consommés
   - Analyse d'usage

4. **factual_data_cache** (nouvelle)
   - Cache des données factuelles par location/secteur
   - Partage entre analyses similaires

## 🔧 Configuration

### Variables d'environnement requises

```bash
# Brave Search API
BRAVE_SEARCH_API_KEY=your_brave_search_api_key

# DeepWiki (si serveur MCP séparé)
DEEPWIKI_API_URL=http://localhost:3001

# Existantes
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
DEEPSEEK_API_KEY=your_deepseek_key
```

### Installation MCP (quand disponible)

```bash
# Installer les packages MCP
npm install @modelcontextprotocol/client
npm install mcp-brave-search  
npm install mcp-deepwiki
```

## 📊 Utilisation

### API Enrichissement

```javascript
// POST /.netlify/functions/enhance-opportunity
{
  "opportunityId": "uuid",
  "enrichmentLevel": "basic|premium", 
  "userId": "user_uuid",
  "forceRefresh": false
}
```

### Réponse enrichie

```javascript
{
  "opportunity_id": "uuid",
  "enrichment_level": "premium",
  "enrichment_status": "completed",
  "factual_data": {
    "demographics": { population: 797003, density: "2,120 hab/km²" },
    "infrastructure": { transport: {...}, utilities: {...} },
    "economic_indicators": { gdp_per_capita: 8266, currency: "XAF" }
  },
  "market_research": {
    "market_size": { estimated_value: "50M XAF", growth_rate: "8%" },
    "growth_trends": ["Digitalisation", "Urbanisation"],
    "customer_segments": [...]
  },
  "competitor_analysis": {
    "direct_competitors": [...],
    "market_gaps": [...],
    "competitive_landscape": {...}
  },
  "regulatory_info": {
    "licenses_required": [...],
    "regulations": [...],
    "government_programs": [...]
  },
  "confidence_score": 8.5,
  "recommendations": [...]
}
```

## 💰 Système de crédits

- **Basic** : Gratuit, données limitées
- **Premium** : 5 crédits, analyse complète
- Intégration avec le système de crédits existant
- Vérification automatique du solde
- Consommation après succès uniquement

## 🎨 Interface utilisateur

### Prochaines étapes
1. Composant `EnhancedOpportunityCard` avec onglets
2. Panels spécialisés pour chaque type de données
3. Visualisations interactives
4. Boutons d'upgrade vers premium

## 🚀 Déploiement

### Étapes de déploiement
1. ✅ Schéma BDD créé
2. ✅ Clients MCP implémentés
3. ✅ Service d'enrichissement créé
4. ✅ Intégration automatique ajoutée
5. ⏳ Interface utilisateur à améliorer
6. ⏳ Tests et optimisations

### Commandes de déploiement

```bash
# Appliquer le schéma BDD
psql -h your-supabase-host -d postgres -f database/enhanced-opportunities-schema.sql

# Déployer les fonctions
netlify deploy --prod

# Tester l'enrichissement
curl -X POST https://gabon24-7.netlify.app/.netlify/functions/enhance-opportunity \
  -H "Content-Type: application/json" \
  -d '{"opportunityId":"test-uuid","enrichmentLevel":"basic"}'
```

## 🔍 Monitoring

### Métriques disponibles
- Temps de traitement par type d'enrichissement
- Taux de succès des appels MCP
- Utilisation du cache
- Consommation de crédits
- Score de confiance moyen

### Logs à surveiller
- Performance des clients MCP
- Erreurs d'API externe
- Cache hit/miss ratio
- Timeout des enrichissements

## 🛡️ Sécurité et limites

### Gestion des erreurs
- Fallback gracieux si MCP indisponible
- Timeout configuré (45s max)
- Cache pour éviter la surcharge
- Enrichissement minimal en cas d'échec

### Limitations actuelles
- Brave Search API limitée en version gratuite
- DeepWiki simulé en attendant le MCP réel
- Cache partagé (peut exposer des données)
- Pas de validation approfondie des données MCP

## 📈 Évolutions futures

### Améliorations prévues
1. **MCP RepoMap** pour analyse technique
2. **Intégration temps réel** avec Supabase Realtime
3. **IA de validation** des données collectées
4. **Recommendations personnalisées** par secteur
5. **Export PDF** des analyses enrichies
6. **API webhooks** pour mise à jour automatique

### Optimisations
- Cache Redis pour les données fréquentes
- Queue system pour enrichissements batch
- ML scoring pour la qualité des données
- Rate limiting intelligent par utilisateur
