# 🔊 Système de Résumés Audio - Documentation

## Vue d'ensemble

Le système de résumés audio permet aux utilisateurs de générer des synthèses vocales d'actualités en français, anglais et chinois. Deux modes sont disponibles : quotidien et personnalisé.

### ⚡ Mode Quotidien (Daily)
- **Analyse automatique** de TOUS les articles des dernières 24 heures
- **Résumé IA politique** généré par GPT-4 (max 2 minutes / 300 mots)
- **Focus sur la politique** avec mention des autres sujets importants
- **TTS haute qualité** via Replicate Kokoro (82M paramètres)

### 🎨 Mode Personnalisé (Custom)
- Sélection manuelle jusqu'à 5 articles
- Script simple avec résumés des articles choisis
- Même qualité audio Kokoro

## Architecture

### Backend (Express.js)
- **Routes**: `/backend/routes/audio.js`
- **Services**:
  - `/services/daily-news-analyzer.js` - Analyse IA des articles 24h
  - `/services/replicate-kokoro-tts.js` - Génération audio Kokoro
- **Processing**: Traitement asynchrone avec mise à jour temps réel du statut
- **IA**: GPT-4o-mini pour analyse et résumé politique
- **TTS**: Replicate Kokoro-82M (open-weight, Apache 2.0)
- **Storage**: Supabase Storage bucket `audio-summaries`

### Frontend (Next.js)
- **Pages principales**:
  - `/audio` - Sélection du mode (quotidien/personnalisé)
  - `/audio/daily` - Génération de résumé quotidien
  - `/audio/custom` - Génération de résumé personnalisé
- **Realtime**: WebSocket Supabase pour mise à jour du statut

### Base de données (Supabase)

#### Table `audio_summaries`
```sql
- id: UUID (PK)
- user_id: UUID (FK -> auth.users)
- summary_type: VARCHAR ('daily' | 'custom')
- article_ids: UUID[] (tableau d'IDs d'articles)
- articles_count: INTEGER
- text_summary: TEXT (script généré)
- audio_url: TEXT (URL publique Supabase Storage)
- audio_duration_seconds: INTEGER
- whatsapp_sent: BOOLEAN
- status: VARCHAR (processing, synthesizing_audio, uploading_audio, completed, failed)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### Table `audio_settings`
```sql
- id: UUID (PK)
- user_id: UUID (FK -> auth.users, UNIQUE)
- voice: VARCHAR (alloy, nova, shimmer, etc.)
- speed: DECIMAL (0.85 - 1.15)
- auto_play: BOOLEAN
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

## API Endpoints

### GET `/api/audio/history/:userId`
Récupère l'historique des résumés audio d'un utilisateur.

**Réponse:**
```json
{
  "success": true,
  "summaries": [
    {
      "id": "uuid",
      "summary_type": "daily",
      "articles_count": 3,
      "text_summary": "...",
      "audio_url": "https://...",
      "audio_duration_seconds": 120,
      "status": "completed",
      "created_at": "2025-10-07T22:00:00Z"
    }
  ]
}
```

### GET `/api/audio/settings/:userId`
Récupère les paramètres audio d'un utilisateur.

**Réponse:**
```json
{
  "success": true,
  "settings": {
    "voice": "alloy",
    "speed": 1.0,
    "auto_play": false
  }
}
```

### PUT `/api/audio/settings`
Met à jour les paramètres audio d'un utilisateur.

**Body:**
```json
{
  "userId": "uuid",
  "voice": "nova",
  "speed": 1.1,
  "auto_play": true
}
```

### POST `/api/audio/generate-summary`
Génère un résumé audio (quotidien ou personnalisé).

**Body (daily):**
```json
{
  "action": "daily",
  "userId": "uuid",
  "language": "fr",
  "pace": "normal",
  "optimize": true,
  "sendWhatsApp": false
}
```

**Body (custom):**
```json
{
  "action": "custom",
  "userId": "uuid",
  "articleIds": ["uuid1", "uuid2"],
  "language": "fr",
  "pace": "normal",
  "optimize": true,
  "sendWhatsApp": false
}
```

**Réponse immédiate:**
```json
{
  "success": true,
  "summaryId": "uuid"
}
```

## Workflow de génération

1. **Création initiale** (status: `processing`)
   - Insertion en base avec statut `processing`
   - Réponse immédiate au client avec `summaryId`
   - Traitement asynchrone démarre

2. **Génération du script texte** (status: `synthesizing_audio`)
   - Récupération des articles (politique pour daily, sélection pour custom)
   - Construction du script selon la langue
   - Sauvegarde du `text_summary`

3. **Génération audio OpenAI** (status: `uploading_audio`)
   - Appel API OpenAI TTS avec voix adaptée à la langue
   - Conversion du buffer audio
   - Upload vers Supabase Storage

4. **Finalisation** (status: `completed`)
   - Mise à jour avec `audio_url` et `audio_duration_seconds`
   - Notification temps réel via WebSocket Supabase

5. **En cas d'erreur** (status: `failed`)
   - Capture de l'erreur
   - Mise à jour du statut

## Langues supportées

| Langue | Code | Voix Kokoro | Intro exemple |
|--------|------|-------------|---------------|
| Français | `fr` | `af_sarah` | "Bonjour. Voici votre résumé d'actualités..." |
| Anglais | `en` | `af_bella` | "Hello. Here is your news summary..." |
| Chinois | `zh` | `af_nicole` | "您好。这是您的新闻摘要..." |

### Voix disponibles Kokoro
- **Français**: af_sarah (voix naturelle)
- **Anglais US**: af_bella (voix américaine)
- **Chinois**: af_nicole (Mandarin)

Kokoro supporte également: anglais britannique, hindi, italien, japonais

## Vitesses de lecture

| Pace | Speed Kokoro | Description |
|------|--------------|-------------|
| `slow` | 0.85 | Lecture lente, claire |
| `normal` | 1.0 | Vitesse normale (recommandé) |
| `fast` | 1.2 | Lecture rapide |

### Configuration requise

### Variables d'environnement
```env
# Analyse IA (recommandé pour résumés politiques intelligents)
OPENAI_API_KEY=sk-proj-...

# TTS Audio (obligatoire pour générer l'audio)
REPLICATE_API_TOKEN=r8_...

# Base de données
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
**Sans OPENAI_API_KEY**: Un résumé basique sera généré (top 3 articles)
**Sans REPLICATE_API_TOKEN**: Seul le script texte sera disponible (pas d'audio)

### Supabase Storage
- Bucket: `audio-summaries`
- Public: Oui
- Types MIME: `audio/mpeg`, `audio/mp3`, `audio/wav`
- Taille max: 50MB
## Tests

### Vérifier les tables
```bash
node backend/check-audio-tables.js
```

### Configurer le Storage
```bash
node backend/setup-audio-storage.js
```

### Test complet du système
```bash
node backend/test-audio-system.js
```

## Monitoring

### Logs backend
- Création résumé: `✅ Audio summary {id} généré avec succès`
- Erreur: `❌ Erreur traitement audio {id}:`

### Statuts en temps réel
Le frontend écoute les changements via Supabase Realtime:
```typescript
supabase
  .channel(`audio_summaries_${userId}`)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'audio_summaries', 
    filter: `user_id=eq.${userId}` 
  }, () => { fetchHistory() })
  .subscribe()
```

## Crédits utilisateur

### Coûts estimés
- **Daily**: 50 crédits (3 articles politique)
- **Custom**: 20 crédits de base + 5 crédits par article au-delà de 5

### Vérification
```javascript
const requiredCredits = action === 'daily' 
  ? 50 
  : (20 + Math.max(0, articleIds.length - 5) * 5);
```

## Sécurité

### Row Level Security (RLS)
- Les utilisateurs ne peuvent voir que leurs propres résumés
- Les utilisateurs ne peuvent modifier que leurs propres paramètres
- Service Role Key utilisée côté backend pour bypass RLS

### Validation
- `userId` obligatoire
- `action` doit être 'daily' ou 'custom'
- Maximum 5 articles pour custom
- CORS configuré pour frontend Next.js

## Améliorations futures

- [ ] Système de crédits complet avec paiement
- [ ] Envoi WhatsApp automatique
- [ ] Support de plus de voix OpenAI
- [ ] Cache des résumés quotidiens
- [ ] Partage de résumés entre utilisateurs
- [ ] Transcription avec timestamps
- [ ] Export MP3 local

## Support

Pour toute question ou problème:
1. Vérifier les logs backend
2. Tester avec `test-audio-system.js`
3. Vérifier que OPENAI_API_KEY est configurée
4. Vérifier les permissions RLS Supabase
