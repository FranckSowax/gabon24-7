# 🔊 Système de Résumés Audio Automatiques

## 📋 Vue d'ensemble

Le système génère automatiquement **9 résumés audio quotidiens** :
- **3 créneaux horaires** : 7h, 13h, 20h
- **3 langues** par créneau : 🇫🇷 Français, 🇺🇸 English, 🇨🇳 中文
- **Total** : 9 résumés/jour

## 🎯 Architecture

### 1. Génération automatique (Cron)
Le planificateur s'exécute automatiquement via `audio-scheduler.js` :
- **7h00** (Africa/Libreville) : Résumés du matin (FR, EN, ZH)
- **13h00** : Résumés de l'après-midi (FR, EN, ZH)
- **20h00** : Résumés du soir (FR, EN, ZH)

### 2. Stack technologique
- **IA Résumés** : OpenAI GPT-4 (via `daily-news-analyzer.js`)
- **TTS (Text-to-Speech)** : Replicate Kokoro v1.0 (`replicate-kokoro-tts.js`)
- **Stockage audio** : Supabase Storage bucket `audio-summaries`
- **Base de données** : Supabase table `audio_summaries`

### 3. Voix par langue
```javascript
{
  'fr': 'af_bella',  // Voix féminine claire
  'en': 'af_bella',  // Voix féminine américaine
  'zh': 'af_nicole'  // Voix féminine chinoise
}
```

## 🚀 Génération manuelle

### Générer tous les résumés maintenant
```bash
cd backend
node generate-all-daily-audios.js
```

Cela génère **les 9 résumés** :
- ✅ Récupère articles des dernières 24h
- ✅ Génère résumé IA pour chaque langue
- ✅ Crée l'audio avec Kokoro TTS
- ✅ Upload vers Supabase Storage
- ✅ Met à jour la BDD

### Tester les voix Kokoro
```bash
cd backend
node test-kokoro-voices.js
```

Génère 3 fichiers audio de test dans `backend/test-audio-output/` :
- `test-fr-{timestamp}.mp3`
- `test-en-{timestamp}.mp3`
- `test-zh-{timestamp}.mp3`

## 🔧 Configuration requise

### Variables d'environnement

#### Railway (Production)
```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Local (.env)
```env
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Obtenir les clés API

**1. Replicate (TTS)**
- Créer un compte sur https://replicate.com
- Aller dans Account → API Tokens
- Copier le token `r8_...`

**2. OpenAI (IA Résumés)**
- Créer un compte sur https://platform.openai.com
- Aller dans API Keys
- Créer une nouvelle clé `sk-...`

**3. Supabase Service Role**
- Tableau de bord Supabase
- Project Settings → API
- Copier `service_role` key (pas `anon`!)

## 📊 Structure de la base de données

### Table `audio_summaries`
```sql
- id (uuid)
- user_id (uuid, nullable) -- NULL = résumé public
- summary_type (text) -- 'daily' ou 'custom'
- time_slot (text) -- 'morning', 'afternoon', 'evening', 'test'
- language (text) -- 'fr', 'en', 'zh'
- article_ids (uuid[])
- articles_count (integer)
- text_summary (text) -- Résumé textuel IA
- audio_url (text) -- URL Supabase Storage
- audio_duration_seconds (integer)
- voice_used (text) -- 'af_bella', 'af_nicole', etc.
- status (text) -- 'processing', 'completed', 'failed'
- created_at (timestamptz)
- completed_at (timestamptz)
```

## 🌐 API Endpoints

### Récupérer le dernier résumé (langue spécifique)
```bash
GET /api/audio/latest-public?language=fr
GET /api/audio/latest-public?language=en
GET /api/audio/latest-public?language=zh
```

### Récupérer tous les résumés publics
```bash
GET /api/audio/public?language=fr&limit=10
```

### Générer un résumé de test
```bash
POST /api/audio/generate-test-summary
Content-Type: application/json

{
  "language": "fr"
}
```

## 📱 Frontend

### Page de consultation
```
https://gabon24-7.netlify.app/audio/daily
```

**Fonctionnalités** :
- Sélecteur de langue (🇫🇷 🇺🇸 🇨🇳)
- Lecteur audio HTML5
- Historique des résumés récents
- Actualisation automatique

## 🔍 Dépannage

### Audio non généré
```bash
# Vérifier les variables d'environnement
echo $REPLICATE_API_TOKEN

# Tester la connexion Replicate
node -e "require('./services/replicate-kokoro-tts').testConnection()"
```

### Aucun article trouvé
```bash
# Vérifier les articles récents
node -e "
const s = require('./supabase-config');
s.supabase.from('articles')
  .select('count')
  .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
  .then(r => console.log('Articles 24h:', r))
"
```

### Status bloqué en "processing"
Les résumés se traitent en **asynchrone**. Attendre 2-5 minutes.

Vérifier les logs Railway :
```
railway logs
```

## 📅 Planning automatique

### Vérifier que le scheduler est actif
Dans `server.js` ligne 3843-3844 :
```javascript
const { startScheduler } = require('./services/audio-scheduler');
startScheduler();
```

### Fuseau horaire
Configuré sur **Africa/Libreville** (GMT+1)

## 🎬 Workflow complet

1. **Cron déclenche** → `generateMultilingualSummaries('morning')`
2. **Pour chaque langue** (FR, EN, ZH) :
   - Récupère articles 24h
   - Crée entrée BDD (status: 'processing')
   - Lance traitement asynchrone
3. **Traitement async** :
   - Génère résumé IA avec OpenAI
   - Sauvegarde `text_summary` en BDD
   - Génère audio avec Kokoro (si REPLICATE_API_TOKEN)
   - Upload MP3 vers Supabase Storage
   - Met à jour BDD avec `audio_url` et status: 'completed'
4. **Frontend affiche** le résumé via `/api/audio/latest-public`

## 📈 Limites et quotas

### Replicate Kokoro
- Max 4000 caractères par requête
- Temps génération : 5-30 secondes
- Coût : ~$0.0004/seconde audio

### OpenAI GPT-4
- Recommandé : Résumés < 500 mots
- Coût : ~$0.03/1000 tokens

### Supabase Storage
- Bucket : `audio-summaries`
- Limite upload : 50MB/fichier
- Fichiers publics (pas d'auth requise)

---

**Dernière mise à jour** : 16 octobre 2025  
**Auteur** : Système Gabon24-7
