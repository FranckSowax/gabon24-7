# 🤖 SCRIPTS D'ENRICHISSEMENT DES ARTICLES

## 📋 DESCRIPTION

Scripts pour enrichir automatiquement les articles avec l'IA (GPT-4o-mini).

**Enrichissement inclut** :
- ✅ Catégorie (Politique, Économie, Sport, etc.)
- ✅ Résumé IA (2-3 phrases)
- ✅ Mots-clés (5-8 keywords)
- ✅ Score de sentiment (-1 à 1)
- ✅ Score d'importance (1-10)
- ✅ Breaking news (true/false)
- ✅ Entités (personnes, lieux, organisations)
- ✅ Topic principal

---

## 📦 SCRIPTS DISPONIBLES

### **1. enrich-articles-test.js** 🧪

**Test sur 5 articles**

```bash
cd backend/scripts
node enrich-articles-test.js
```

**Utilité** :
- Tester le système avant le traitement massif
- Vérifier la qualité de l'enrichissement
- Estimer le coût et le temps

**Coût** : ~$0.001 (5 articles)

---

### **2. enrich-articles-batch.js** 🚀

**Enrichissement massif de tous les articles pending**

```bash
cd backend/scripts
node enrich-articles-batch.js
```

**Caractéristiques** :
- Traite tous les articles en statut `pending`
- Batch de 10 articles à la fois
- Pause de 2s entre chaque batch (évite rate limit)
- Retry automatique en cas d'erreur
- Statistiques en temps réel
- Interruption gracieuse (Ctrl+C)

**Coût estimé** : ~$1.20 pour 12,134 articles
**Temps estimé** : ~2 heures

---

## ⚙️ CONFIGURATION

### **Variables d'environnement requises**

```env
# .env dans backend/
OPENAI_API_KEY=sk-xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx
```

### **Dépendances**

```bash
cd backend
npm install openai @supabase/supabase-js dotenv
```

---

## 🚀 UTILISATION

### **ÉTAPE 1 : TEST** (Recommandé)

```bash
# Tester sur 5 articles
cd backend/scripts
node enrich-articles-test.js
```

**Vérifier** :
1. Les articles sont bien enrichis
2. La qualité des catégories et résumés
3. Pas d'erreurs

**Exemple de sortie** :
```
🧪 TEST D'ENRICHISSEMENT - 5 ARTICLES

📰 Article: Le président gabonais en visite...
⏳ Enrichissement en cours...
✅ Article enrichi avec succès!
   Catégorie: Politique
   Topic: Visite présidentielle
   Importance: 8/10
   Sentiment: 0.5

================================================
📊 RÉSULTATS DU TEST
================================================
✅ Succès: 5
❌ Échecs: 0
================================================

✅ Total articles enrichis dans la base: 15
```

---

### **ÉTAPE 2 : ENRICHISSEMENT MASSIF**

```bash
# Enrichir tous les articles
cd backend/scripts
node enrich-articles-batch.js
```

**Exemple de sortie** :
```
🚀 DÉMARRAGE ENRICHISSEMENT MASSIF DES ARTICLES

📝 12,134 articles à enrichir

📦 Batch 1/1214
⏳ Enrichissement article: Le gouvernement annonce...
✅ Article enrichi: Le gouvernement annonce...
⏳ Enrichissement article: Match de football...
✅ Article enrichi: Match de football...

============================================================
📊 STATISTIQUES
============================================================
Total à traiter: 12134
Traités: 10 / 12134 (0%)
✅ Succès: 10
❌ Échecs: 0
⏭️  Ignorés: 0
⏱️  Temps écoulé: 0m 45s
⚡ Vitesse: 13 articles/minute
⏳ ETA: ~155m 0s
============================================================

⏸️  Pause 2000ms avant le prochain batch...
```

---

### **ÉTAPE 3 : VÉRIFICATION**

```bash
# Vérifier le résultat dans Supabase
# OU via script SQL
```

```sql
SELECT 
  enrichment_status,
  COUNT(*) as count
FROM articles
GROUP BY enrichment_status;

-- Résultat attendu:
-- completed: 12144
-- failed: 0
-- pending: 0
```

---

## 🛑 ARRÊTER LE SCRIPT

**Interruption gracieuse** :
```
Ctrl+C
```

Le script affiche les statistiques et s'arrête proprement.

**Reprendre plus tard** :
Le script reprend automatiquement là où il s'est arrêté (traite uniquement les `pending`).

---

## 🔍 MONITORING

### **Pendant l'exécution**

Le script affiche :
- ✅ Articles traités avec succès
- ❌ Articles en erreur
- 📊 Statistiques toutes les 10 secondes
- ⚡ Vitesse de traitement
- ⏳ Temps restant estimé

### **Après l'exécution**

```sql
-- Vérifier les résultats
SELECT 
  COUNT(*) FILTER (WHERE enrichment_status = 'completed') as completed,
  COUNT(*) FILTER (WHERE enrichment_status = 'failed') as failed,
  COUNT(*) FILTER (WHERE enrichment_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE category IS NOT NULL) as avec_category,
  COUNT(*) FILTER (WHERE summary_ai IS NOT NULL) as avec_summary
FROM articles;
```

---

## ❌ GESTION DES ERREURS

### **Erreurs API OpenAI**

**Causes** :
- Rate limit dépassé
- Timeout
- Quota dépassé

**Solution** :
- Le script retry automatiquement (3 tentatives)
- Pause de 2s entre les batch
- Après 3 échecs → marqué `failed`

### **Articles failed**

```sql
-- Voir les articles en échec
SELECT id, title, enrichment_error, enrichment_retries
FROM articles
WHERE enrichment_status = 'failed';

-- Réessayer les articles failed
UPDATE articles 
SET enrichment_status = 'pending',
    enrichment_retries = 0
WHERE enrichment_status = 'failed';

-- Puis relancer le script
```

---

## 💰 ESTIMATION COÛTS

### **GPT-4o-mini Pricing**

```
Input:  $0.150 / 1M tokens
Output: $0.600 / 1M tokens
```

### **Par article**

```
Input:  ~500 tokens  → $0.000075
Output: ~200 tokens  → $0.000120
Total:  ~700 tokens  → $0.000195 (~$0.0002)
```

### **Pour 12,134 articles**

```
12,134 × $0.0002 = $2.43 (estimation haute)
Réel probable: ~$1.20 - $1.50
```

**C'est négligeable comparé aux bénéfices** :
- ✅ 100% articles enrichis
- ✅ UX professionnelle
- ✅ SEO optimisé
- ✅ Métadonnées complètes

---

## 📊 RÉSULTATS ATTENDUS

### **Avant**

```
Articles pending: 12,134 (99.92%)
Articles sans catégorie: 12
Articles sans résumé IA: 7,208
Articles sans keywords: 4,643
```

### **Après**

```
Articles completed: 12,144 (100%)
Articles avec catégorie: 12,144 (100%)
Articles avec résumé IA: 12,144 (100%)
Articles avec keywords: 12,144 (100%)
```

---

## 🎯 NEXT STEPS

### **Après l'enrichissement**

1. **Vérifier la qualité**
   ```sql
   SELECT id, title, category, topic, importance
   FROM articles
   WHERE enrichment_status = 'completed'
   ORDER BY importance DESC
   LIMIT 10;
   ```

2. **Modifier le RSS processor**
   - Ajouter l'enrichissement immédiat lors de l'extraction
   - Voir `backend/rss-processor.js`

3. **Mettre à jour le frontend**
   - Utiliser les nouvelles métadonnées
   - Afficher `category`, `topic`, `is_breaking`
   - Utiliser `importance` pour le tri

---

## ⚠️ WARNINGS

1. **Ne pas lancer les 2 scripts en même temps**
   - Risque de duplication
   - Rate limit OpenAI

2. **Vérifier les quotas OpenAI**
   - Tier 1 : 200 req/min
   - Tier 2 : 500 req/min
   - Le script respecte les limites avec les pauses

3. **Backup avant traitement massif**
   - Table `articles_backup` déjà créée ✅
   - Mais possibilité de créer un backup supplémentaire

---

## 📝 TROUBLESHOOTING

### **Erreur : Missing API key**

```bash
# Vérifier .env
cat backend/.env | grep OPENAI_API_KEY
```

### **Erreur : Rate limit exceeded**

```bash
# Augmenter DELAY_BETWEEN_BATCHES dans le script
# De 2000ms à 3000ms ou 5000ms
```

### **Erreur : Insufficient quota**

```bash
# Vérifier quota OpenAI
# https://platform.openai.com/account/billing
```

### **Articles bloqués en 'processing'**

```sql
-- Réinitialiser
UPDATE articles 
SET enrichment_status = 'pending'
WHERE enrichment_status = 'processing';
```

---

## ✅ CHECKLIST

Avant de lancer l'enrichissement massif :

- [ ] Variables d'environnement configurées
- [ ] Dépendances installées (`npm install`)
- [ ] Test réussi (5 articles)
- [ ] Quota OpenAI vérifié
- [ ] Backup table articles existe
- [ ] Temps disponible (~2h pour tout enrichir)

---

## 📞 SUPPORT

En cas de problème :
1. Vérifier les logs du script
2. Vérifier les articles `failed` dans la base
3. Consulter les docs OpenAI
4. Ajuster les paramètres du script si besoin

**Le script est conçu pour être robuste et reprendre automatiquement en cas d'interruption !** 🚀
