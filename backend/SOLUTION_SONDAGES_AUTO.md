# 📊 SYSTÈME DE GÉNÉRATION AUTOMATIQUE DE SONDAGES

## 🎯 CONCEPT

Génération intelligente de questions de sondages basées sur les résumés audio quotidiens de l'actualité.

**Flux de données:**
```
Articles RSS (24h) 
    ↓
Résumé Audio IA (7h du matin)
    ↓
Analyse du résumé
    ↓
Génération de 3 questions de sondage pertinentes
    ↓
Sondages publiés automatiquement
```

## ✨ FONCTIONNALITÉS

### 1. Génération Intelligente par IA
- **Analyse contextuelle** du résumé audio quotidien
- **Extraction des sujets importants** (politique, économie, social)
- **Génération de 3 questions** par OpenAI GPT-4o-mini
- **4 options de réponse** équilibrées et neutres par question
- **Catégorisation automatique** des questions

### 2. Automation Complète
- **Déclenchement automatique** tous les matins à 7h
- **Génération après le résumé audio** en français
- **Désactivation des vieux sondages** (>2 jours)
- **Publication automatique** sur la plateforme

### 3. Fallback Intelligent
- Si OpenAI indisponible → questions par défaut basées sur les articles
- Si pas de résumé audio → utilisation des articles directs
- Gestion robuste des erreurs

## 🏗️ ARCHITECTURE

### Fichiers Créés

#### 1. `/backend/services/poll-generator-from-audio.js`
Service principal de génération de sondages.

**Fonctions principales:**

```javascript
// Génère des questions depuis un résumé audio
generatePollQuestionsFromSummary(summaryText, articles)

// Sauvegarde les questions dans Supabase
savePollQuestions(questions, audioSummaryId)

// Génère depuis le dernier résumé audio quotidien
generatePollsFromLatestAudioSummary()

// Désactive les anciens sondages automatiques
deactivateOldAutoPpolls()
```

#### 2. `/backend/services/audio-scheduler.js` (modifié)
Intégration dans le planificateur audio.

**Modifications:**
- Génération automatique de sondages après résumé du matin (7h)
- Seulement pour le résumé en français
- Logs détaillés du processus

#### 3. `/backend/server.js` (modifié)
Ajout de l'endpoint API manuel.

**Nouvel endpoint:**
```javascript
POST /api/polls/generate-from-audio
```

## 📋 FORMAT DES QUESTIONS GÉNÉRÉES

### Structure JSON OpenAI
```json
{
  "questions": [
    {
      "question": "Comment évaluez-vous la politique économique actuelle ?",
      "category": "Économie",
      "options": [
        "Très positif",
        "Plutôt positif",
        "Plutôt négatif",
        "Très négatif"
      ],
      "context": "Suite aux récentes décisions gouvernementales sur le budget"
    }
  ]
}
```

### Consignes pour l'IA
1. Chaque question sur un sujet DIFFÉRENT
2. Formulation neutre et objective
3. 4 options équilibrées
4. Encourage la réflexion et le débat
5. Privilégie sujets politiques/économiques/sociétaux
6. Évite questions techniques ou évidentes

## 🗄️ STRUCTURE BASE DE DONNÉES

### Table `polls`
```sql
- id (uuid)
- title (text) -- Question du sondage
- description (text) -- Contexte
- is_active (boolean)
- is_featured (boolean) -- Premier sondage mis en avant
- category (text) -- Politique, Économie, Social, etc.
- source (text) -- 'auto_generated' pour sondages automatiques
- audio_summary_id (uuid) -- Référence au résumé audio source
- created_at (timestamp)
```

### Table `poll_questions`
```sql
- id (uuid)
- poll_id (uuid) -- Référence au sondage
- question_text (text)
- question_type (text) -- 'multiple_choice'
- question_order (int)
- is_required (boolean)
```

### Table `poll_options`
```sql
- id (uuid)
- question_id (uuid) -- Référence à la question
- option_text (text)
- option_order (int)
```

### Table `poll_votes`
```sql
- id (uuid)
- user_id (uuid)
- poll_id (uuid)
- question_id (uuid)
- response (text)
- created_at (timestamp)
```

## 🚀 UTILISATION

### 1. Génération Automatique (Recommandé)

**Planification:** Tous les jours à 7h du matin (après le résumé audio)

Le système:
1. ✅ Génère le résumé audio quotidien
2. ✅ Analyse le résumé avec OpenAI
3. ✅ Génère 3 questions de sondage
4. ✅ Désactive les vieux sondages
5. ✅ Publie les nouveaux sondages

**Aucune action manuelle requise !**

### 2. Génération Manuelle via API

```bash
# Générer des sondages depuis le dernier résumé audio
curl -X POST http://localhost:3001/api/polls/generate-from-audio
```

**Réponse:**
```json
{
  "success": true,
  "message": "3 sondages générés depuis le résumé audio",
  "created": 3,
  "total": 3,
  "polls": [
    {
      "pollId": "uuid",
      "questionId": "uuid",
      "question": "Question du sondage?",
      "optionsCount": 4
    }
  ]
}
```

### 3. Test Direct du Service

```bash
cd /Volumes/Samsung_T5/gabon24-7-main/backend

# Tester le générateur
node test-poll-generator.js

# Ou exécuter le service directement
node services/poll-generator-from-audio.js
```

## 📊 EXEMPLES DE QUESTIONS GÉNÉRÉES

### Exemple 1 - Politique
```
Question: "Quelle est votre opinion sur les récentes réformes gouvernementales ?"
Catégorie: Politique
Options:
  - Très favorable
  - Plutôt favorable
  - Plutôt défavorable
  - Très défavorable
Contexte: Suite aux annonces du Premier ministre sur les réformes administratives
```

### Exemple 2 - Économie
```
Question: "Quelle devrait être la priorité économique du gouvernement ?"
Catégorie: Économie
Options:
  - Création d'emplois
  - Soutien aux PME
  - Diversification économique
  - Lutte contre l'inflation
Contexte: Face aux enjeux économiques actuels du pays
```

### Exemple 3 - Social
```
Question: "Comment jugez-vous l'accès aux services de santé au Gabon ?"
Catégorie: Social
Options:
  - Très satisfaisant
  - Satisfaisant
  - Insatisfaisant
  - Très insatisfaisant
Contexte: Suite aux discussions sur le système de santé publique
```

## 🔧 CONFIGURATION

### Variables d'Environnement Requises

```bash
# Obligatoire pour génération IA
OPENAI_API_KEY=sk-...

# Recommandé pour audio (mais pas obligatoire pour sondages)
REPLICATE_API_TOKEN=...
```

### Paramètres de Génération

**Dans `poll-generator-from-audio.js`:**

```javascript
// Nombre de questions générées
const QUESTIONS_COUNT = 3;

// Durée de vie des sondages automatiques
const POLL_LIFETIME_DAYS = 2;

// Température OpenAI (créativité)
temperature: 0.8

// Modèle OpenAI
model: 'gpt-4o-mini'
```

## 📈 LOGS ET MONITORING

### Logs de Génération Automatique

```
📊 Génération automatique des sondages depuis le résumé...
🤖 Appel à OpenAI pour générer les questions...
✅ 3 questions générées par l'IA

💾 SAUVEGARDE DES QUESTIONS DE SONDAGE
✅ Sondage 1 créé: Comment évaluez-vous...
   ✅ 4 options créées
✅ Sondage 2 créé: Quelle devrait être...
   ✅ 4 options créées
✅ Sondage 3 créé: Quel niveau de confiance...
   ✅ 4 options créées

📊 RÉSULTAT: 3/3 sondages créés
✅ 3 sondages créés automatiquement
```

### Logs de Désactivation

```
🧹 Désactivation des sondages automatiques de plus de 2 jours
✅ Anciens sondages automatiques désactivés
```

## 🔄 CYCLE DE VIE DES SONDAGES

1. **Création (7h du matin)**
   - 3 nouveaux sondages générés
   - `is_active = true`
   - `is_featured = true` (premier sondage seulement)
   - `source = 'auto_generated'`

2. **Publication (7h - 9h)**
   - Sondages visibles sur la plateforme
   - Les utilisateurs peuvent voter

3. **Désactivation (après 2 jours)**
   - Anciens sondages automatiques désactivés
   - `is_active = false`
   - Résultats conservés pour historique

4. **Archivage (optionnel)**
   - Les sondages restent en base
   - Statistiques disponibles

## 🧪 TESTS

### Test Complet
```bash
cd backend
node test-poll-generator.js
```

**Résultat attendu:**
```
🧪 TEST GÉNÉRATEUR DE SONDAGES
🎯 GÉNÉRATION DE SONDAGES DEPUIS LE DERNIER RÉSUMÉ AUDIO
📄 Résumé trouvé: uuid
📅 Date: 09/10/2025, 07:15:30
📰 Articles: 45
✅ 45 articles récupérés

📊 3 questions générées:

1. Comment évaluez-vous...
   Catégorie: Politique
   Options: 4

2. Quelle devrait être...
   Catégorie: Économie
   Options: 4

3. Quel niveau de confiance...
   Catégorie: Social
   Options: 4

💾 SAUVEGARDE DES QUESTIONS DE SONDAGE
✅ Sondage 1 créé
✅ Sondage 2 créé
✅ Sondage 3 créé

📊 RÉSULTAT: 3/3 sondages créés

📊 RÉSULTAT FINAL:
{
  "success": true,
  "created": 3,
  "total": 3,
  "polls": [...]
}

✅ Test terminé !
```

### Test API Manuel
```bash
# Vérifier qu'il y a un résumé audio
curl http://localhost:3001/api/audio/summaries | jq '.[-1]'

# Générer les sondages
curl -X POST http://localhost:3001/api/polls/generate-from-audio | jq

# Vérifier les sondages créés
curl http://localhost:3001/api/polls | jq
```

## ⚠️ GESTION D'ERREURS

### Cas 1: Pas de résumé audio
```
⚠️  Aucun résumé audio quotidien trouvé
→ Résultat: Aucun sondage généré, attendre le prochain résumé
```

### Cas 2: OpenAI indisponible
```
⚠️  OPENAI_API_KEY manquant
📝 Génération de questions par défaut...
→ Résultat: 3 questions génériques basées sur les articles
```

### Cas 3: Erreur de parsing JSON
```
❌ Erreur parsing JSON
Contenu reçu: [contenu]
→ Fallback: questions par défaut
```

### Cas 4: Pas assez d'articles
```
Résumé trop court pour générer des questions
→ Fallback: questions génériques
```

## 🎨 INTÉGRATION FRONTEND

### Widget Sondages

Le frontend récupère les sondages via:
```javascript
GET /api/polls
```

Filtrer les sondages automatiques:
```javascript
const autoPolls = polls.filter(p => p.source === 'auto_generated' && p.is_active);
```

Afficher le sondage mis en avant:
```javascript
const featuredPoll = autoPolls.find(p => p.is_featured);
```

## 📅 PLANNING QUOTIDIEN

```
06:45 - Collecte des articles RSS
07:00 - Génération résumé audio (FR/EN/ZH)
07:05 - Analyse du résumé français
07:10 - Génération de 3 questions par OpenAI
07:15 - Sauvegarde et publication des sondages
07:20 - Désactivation des vieux sondages
→ Les utilisateurs peuvent voter toute la journée
```

## 🔮 AMÉLIORATIONS FUTURES

- [ ] Génération multilingue (EN, ZH)
- [ ] Analyse des votes en temps réel
- [ ] Notifications push pour nouveaux sondages
- [ ] Dashboard admin avec statistiques
- [ ] Export des résultats en CSV
- [ ] Sondages thématiques (hebdomadaires, mensuels)
- [ ] Prédictions basées sur les tendances de vote
- [ ] Integration avec réseaux sociaux

## 📞 COMMANDES UTILES

```bash
# Test complet
node test-poll-generator.js

# Génération manuelle
curl -X POST http://localhost:3001/api/polls/generate-from-audio

# Lister les sondages actifs
curl http://localhost:3001/api/polls | jq '.polls[] | select(.is_active == true)'

# Voir les résumés audio récents
curl http://localhost:3001/api/audio/summaries | jq

# Logs du backend
tail -f backend/server.log | grep "📊"
```

---

**Status:** ✅ Système implémenté et opérationnel  
**Déploiement:** Automatique à 7h chaque matin  
**Dernière mise à jour:** 2025-10-09 02:07
