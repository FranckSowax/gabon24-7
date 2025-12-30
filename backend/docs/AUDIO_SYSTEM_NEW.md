# 🔊 Système Audio Amélioré - Résumé Quotidien Intelligent

## 🎯 Nouveautés

### Mode Daily Révolutionné

**Avant:**
- Sélection de 2-3 articles politiques récents uniquement
- Script simple avec concaténation des résumés
- TTS OpenAI (coûteux)

**Maintenant:**
- ✅ **Analyse de TOUS les articles des 24h** (pas de limite)
- ✅ **Résumé IA intelligent par GPT-4o-mini** (accent politique)
- ✅ **TTS Replicate Kokoro** (open-source, moins cher, haute qualité)
- ✅ **Maximum 2 minutes** (optimisé pour écoute rapide)

## 📊 Architecture du Workflow

```
1. Requête POST /api/audio/generate-summary (action: 'daily')
         ↓
2. Récupération articles 24h depuis Supabase
   SELECT * FROM articles WHERE created_at >= NOW() - INTERVAL '24 hours'
         ↓
3. Analyse IA (services/daily-news-analyzer.js)
   - Envoi de tous les articles à GPT-4o-mini
   - Prompt: "Analyse politique + max 300 mots + ton radio"
   - Résumé structuré retourné
         ↓
4. Génération Audio (services/replicate-kokoro-tts.js)
   - Appel API Replicate Kokoro-82M
   - Voix adaptée à la langue (fr: af_sarah, en: af_bella, zh: af_nicole)
   - Vitesse ajustable (0.85 - 1.2x)
         ↓
5. Upload Supabase Storage
   - Bucket: audio-summaries
   - URL publique générée
         ↓
6. Notification temps réel via WebSocket
   - Frontend affiche l'audio player
```

## 🧠 Service d'Analyse IA

**Fichier:** `/backend/services/daily-news-analyzer.js`

### Fonctionnalité

```javascript
async function generateDailySummary(articles, language = 'fr')
```

**Entrée:**
- `articles`: Array de tous les articles des 24h avec leurs champs (title, summary, ai_summary, category, source)
- `language`: 'fr', 'en', ou 'zh'

**Traitement:**
1. Construction du contexte avec tous les articles
2. Envoi prompt intelligent à GPT-4o-mini:
   - Focus politique prioritaire
   - Structure radio professionnelle
   - Maximum 300 mots (2 minutes audio)
   - Ton accessible et captivant

**Sortie:**
- Résumé textuel optimisé pour lecture audio
- Prêt pour TTS

**Fallback (sans OpenAI):**
- Sélection des 3 meilleurs articles politiques
- Script simple de concaténation

## 🎙️ Service TTS Replicate Kokoro

**Fichier:** `/backend/services/replicate-kokoro-tts.js`

### API Replicate

**Modèle:** `jaaari/kokoro-82m`
- 82 millions de paramètres
- Basé sur StyleTTS2
- Apache 2.0 License (open-weight)
- Coût: ~$0.00022 par génération
- Vitesse: ~1 seconde de traitement

### Voix Disponibles

| Langue | Voice ID | Description |
|--------|----------|-------------|
| Français | `af_sarah` | Voix féminine naturelle |
| Anglais US | `af_bella` | Voix américaine claire |
| Chinois | `af_nicole` | Voix Mandarin |

### Fonction principale

```javascript
async function generateAudio(text, language, pace)
```

**Paramètres:**
- `text`: Script à convertir (max 4000 caractères)
- `language`: 'fr', 'en', 'zh'
- `pace`: 'slow' (0.85x), 'normal' (1.0x), 'fast' (1.2x)

**Retour:**
- Buffer MP3 prêt pour upload

**Gestion erreurs:**
- Timeout après 60 secondes
- Retry automatique si échec temporaire
- Logs détaillés pour debugging

## 🔧 Configuration

### Variables d'Environnement

Ajouter dans `.env`:

```bash
# IA pour analyse politique intelligente (recommandé)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# TTS Kokoro (obligatoire pour audio)
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
```

### Obtenir les clés

**OpenAI:**
1. Aller sur https://platform.openai.com/api-keys
2. Créer une nouvelle clé
3. Recharger le compte avec $5 minimum

**Replicate:**
1. Aller sur https://replicate.com/account/api-tokens
2. Créer un token
3. Crédit gratuit disponible

## 📝 Exemple de Résumé Généré

### Input (10 articles des 24h)
```
- "Conseil des ministres : nouvelles nominations"
- "L'opposition dénonce..."
- "Prix du carburant en hausse"
- "Match de football: Gabon vs Congo"
- ... (6 autres articles)
```

### Output GPT-4o-mini
```
Bonjour et bienvenue dans votre résumé politique du Gabon.

Au Conseil des ministres d'hier, le président a procédé à plusieurs 
nominations stratégiques, notamment à la tête du ministère de l'Économie 
où Jean Dupont remplace Marie Martin. Cette décision intervient dans un 
contexte économique tendu.

L'opposition, par la voix de son chef Pierre Durand, a vivement critiqué 
la hausse des prix du carburant annoncée cette semaine, la qualifiant 
d'"inacceptable pour les familles gabonaises". Le gouvernement justifie 
cette mesure par l'augmentation des cours mondiaux.

Sur le plan sportif, l'équipe nationale s'est imposée 2-1 face au Congo 
hier soir, une victoire importante pour les éliminatoires.

Voilà pour ce résumé de l'actualité. Bonne journée.
```

**Durée:** ~90 secondes
**Mots:** ~180

## 🧪 Tests

### Test Complet du Système

```bash
node backend/test-daily-audio.js
```

Ce script:
1. Vérifie la configuration (clés API)
2. Lance génération résumé quotidien
3. Suit la progression en temps réel
4. Affiche le résumé texte et l'URL audio

### Test Unitaire Replicate

```bash
node backend/services/replicate-kokoro-tts.js
```

### Test Service Analyse IA

```bash
node
> const { generateDailySummary } = require('./services/daily-news-analyzer');
> const articles = [...]; // vos articles
> const summary = await generateDailySummary(articles, 'fr');
> console.log(summary);
```

## 📊 Performance

### Métriques Typiques

**Résumé quotidien avec 50 articles:**
- Récupération articles: ~0.5s
- Analyse IA GPT-4: ~5-10s
- Génération audio Kokoro: ~3-5s
- Upload Supabase: ~1s
- **Total: 10-17 secondes**

**Coûts:**
- GPT-4o-mini: ~$0.0003 par résumé
- Replicate Kokoro: ~$0.00022 par audio
- **Total: ~$0.00052 par résumé quotidien**

## 🐛 Dépannage

### Erreur "OPENAI_API_KEY manquant"
**Solution:** Ajouter la clé dans `.env` ou accepter le résumé basique

### Erreur "REPLICATE_API_TOKEN manquant"
**Solution:** Ajouter la clé dans `.env` ou utiliser mode texte uniquement

### Audio ne se génère pas
1. Vérifier logs backend: `tail -f backend/backend.log`
2. Tester connexion: `node services/replicate-kokoro-tts.js`
3. Vérifier crédit Replicate

### Résumé trop court/long
Ajuster le prompt dans `services/daily-news-analyzer.js` ligne 45

### Voix ne correspond pas
Modifier le mapping dans `services/replicate-kokoro-tts.js` ligne 27

## 🚀 Améliorations Futures

- [ ] Cache des résumés quotidiens (1 par jour max)
- [ ] Support d'autres voix Kokoro (britannique, italienne, etc.)
- [ ] Résumés thématiques (Sport, Économie, Société)
- [ ] Podcasts hebdomadaires automatisés
- [ ] Transcription avec timestamps pour accessibilité
- [ ] Export MP3 local pour lecture offline

## 📞 Support

Pour toute question:
1. Consulter les logs: `backend/backend.log`
2. Tester avec: `node backend/test-daily-audio.js`
3. Vérifier documentation Replicate: https://replicate.com/jaaari/kokoro-82m

---

**Version:** 2.0 - Système Audio Intelligent avec Analyse IA
**Date:** 2025-10-07
**Auteur:** Gabon 24/7 Team
