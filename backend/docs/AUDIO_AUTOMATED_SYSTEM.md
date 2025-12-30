# 🤖 Système Automatisé de Résumés Audio

## Vue d'ensemble

Le système génère automatiquement **3 résumés audio quotidiens** à des heures fixes :
- 🌅 **7h00** : Résumé du matin
- ☀️ **13h00** : Résumé de l'après-midi
- 🌙 **20h00** : Résumé du soir

Ces résumés sont **publics** (visibles par tous les utilisateurs) et **économisent des tokens** en évitant les générations redondantes.

## 🎯 Avantages

### Économie de Tokens
- **Avant** : Chaque utilisateur génère son propre résumé → N utilisateurs = N résumés
- **Maintenant** : 1 résumé public = ∞ utilisateurs → Économie de 100%

### Expérience Utilisateur
- ✅ **Instantané** : Résumés déjà prêts
- ✅ **Pas d'attente** : Pas de génération à la demande
- ✅ **Actualité fraîche** : 3 fois par jour
- ✅ **Visible dans le feed** : Widget dédié

## 🏗️ Architecture

### Planificateur (Scheduler)

**Fichier** : `/backend/services/audio-scheduler.js`

```javascript
// Cron jobs planifiés
cron.schedule('0 7 * * *', generateMorning)   // 7h00
cron.schedule('0 13 * * *', generateAfternoon) // 13h00
cron.schedule('0 20 * * *', generateEvening)   // 20h00
```

**Fuseau horaire** : `Africa/Libreville` (UTC+1)

### Base de Données

**Résumés publics** : `user_id = NULL` dans `audio_summaries`

```sql
SELECT * FROM audio_summaries 
WHERE user_id IS NULL 
  AND summary_type = 'daily'
  AND time_slot IN ('morning', 'afternoon', 'evening')
ORDER BY created_at DESC;
```

**Nouveau champ** : `time_slot VARCHAR(20)`
- Valeurs : `'morning'`, `'afternoon'`, `'evening'`, `'manual'`, `'test'`

### Workflow de Génération

```
1. Cron déclenche à l'heure programmée
         ↓
2. Récupération articles 24h
   SELECT * FROM articles WHERE created_at >= NOW() - INTERVAL '24 hours'
         ↓
3. Analyse IA GPT-4o-mini
   - Focus politique
   - Max 300 mots (2 min)
   - Ton radio professionnel
         ↓
4. Génération audio Kokoro
   - Voix française (af_sarah)
   - Qualité haute
         ↓
5. Upload Supabase Storage
   - Bucket: audio-summaries
   - Nom: auto-{timeSlot}-{timestamp}.mp3
         ↓
6. Sauvegarde en base
   - user_id: NULL (public)
   - time_slot: morning/afternoon/evening
   - status: completed
         ↓
7. Disponible immédiatement
   - API: /api/audio/public
   - API: /api/audio/latest-public
   - Widget frontend
```

## 📡 API Endpoints

### GET /api/audio/public

Récupère tous les résumés publics.

**Query Parameters:**
- `limit` (optionnel) : Nombre max de résumés (défaut: 10)
- `timeSlot` (optionnel) : Filtrer par créneau (`morning`, `afternoon`, `evening`)

**Exemple:**
```bash
curl http://localhost:3001/api/audio/public?limit=5&timeSlot=morning
```

**Réponse:**
```json
{
  "success": true,
  "summaries": [
    {
      "id": "uuid",
      "user_id": null,
      "summary_type": "daily",
      "time_slot": "morning",
      "articles_count": 45,
      "text_summary": "Bonjour. Voici votre résumé...",
      "audio_url": "https://...",
      "audio_duration_seconds": 120,
      "status": "completed",
      "created_at": "2025-10-07T07:00:00Z"
    }
  ]
}
```

### GET /api/audio/latest-public

Récupère le dernier résumé public disponible.

**Exemple:**
```bash
curl http://localhost:3001/api/audio/latest-public
```

**Réponse:**
```json
{
  "success": true,
  "summary": {
    "id": "uuid",
    "time_slot": "evening",
    "articles_count": 52,
    "text_summary": "Bonsoir. Voici le résumé du soir...",
    "audio_url": "https://...",
    "audio_duration_seconds": 135,
    "status": "completed",
    "created_at": "2025-10-07T20:00:00Z"
  }
}
```

### POST /api/audio/generate-manual

Génère manuellement un résumé (admin/test).

**Body:**
```json
{
  "timeSlot": "test"
}
```

**Exemple:**
```bash
curl -X POST http://localhost:3001/api/audio/generate-manual \
  -H "Content-Type: application/json" \
  -d '{"timeSlot":"test"}'
```

## 🎨 Frontend - Widget Audio

**Fichier** : `/frontend/src/components/widgets/AudioSummaryWidget.tsx`

### Intégration dans le Feed

```tsx
import AudioSummaryWidget from '@/components/widgets/AudioSummaryWidget'

export default function HomePage() {
  return (
    <div>
      {/* Widget résumé audio */}
      <AudioSummaryWidget />
      
      {/* Feed d'articles */}
      <ArticleList articles={articles} />
    </div>
  )
}
```

### Fonctionnalités du Widget

- ✅ Affiche le dernier résumé disponible
- ✅ Emoji selon le créneau (🌅 ☀️ 🌙)
- ✅ Temps écoulé ("Il y a 2h")
- ✅ Aperçu du texte (3 lignes)
- ✅ Nombre d'articles analysés
- ✅ Durée audio estimée
- ✅ Bouton "Écouter" si audio disponible
- ✅ Lien vers page détaillée

## 🧪 Tests

### Test Complet

```bash
node backend/test-audio-scheduler.js
```

Ce script :
1. Vérifie la configuration (clés API)
2. Génère un résumé test
3. Récupère les résumés publics
4. Affiche la liste complète

**Output attendu:**
```
🧪 Test du planificateur de résumés audio

⏰ Horaires planifiés:
   - Matin: 7:00
   - Après-midi: 13:00
   - Soir: 20:00

1️⃣  Génération manuelle d'un résumé test...
✅ Résumé créé: uuid-xxx-xxx
   Le traitement continue en arrière-plan...

2️⃣  Récupération des résumés publics...
✅ 3 résumé(s) trouvé(s)

📋 Liste des résumés:
   1. 🌙 evening - 07/10/2025 20:00:00
      ID: uuid-1
      Statut: completed
      Articles: 52
      Audio: https://...
   
   2. ☀️ afternoon - 07/10/2025 13:00:00
      ...
```

### Test Production Manuelle

```bash
# Générer un résumé "matin" maintenant (hors horaire)
curl -X POST http://localhost:3001/api/audio/generate-manual \
  -H "Content-Type: application/json" \
  -d '{"timeSlot":"morning"}'
```

### Vérifier les Logs

```bash
# Suivre les logs backend en temps réel
tail -f backend/backend.log | grep -E "(🌅|☀️|🌙|🤖)"
```

## 📊 Monitoring

### Vérifier l'État du Scheduler

Le scheduler démarre automatiquement avec le serveur backend.

**Logs de démarrage:**
```
⏰ Démarrage du planificateur de résumés audio automatiques
   - 7h00: Résumé du matin
   - 13h00: Résumé de l'après-midi
   - 20h00: Résumé du soir

✅ Planificateur actif
```

### Logs de Génération

**À chaque génération automatique:**
```
🤖 [07/10/2025 07:00:00] Génération automatique résumé morning
📰 45 articles analysés
✅ Résumé créé: uuid-xxx-xxx
🎬 Traitement uuid-xxx-xxx...
📊 Analyse IA des articles...
📝 Résumé généré: 1248 caractères
🔊 Génération audio Kokoro...
✅ Audio uploadé: https://...
✅ Résumé morning terminé: uuid-xxx-xxx
```

### Métriques Importantes

**À surveiller:**
- Nombre d'articles analysés par génération (doit être > 10)
- Temps de génération total (< 30 secondes idéal)
- Succès audio (si REPLICATE_API_TOKEN présent)
- Taille des résumés (200-300 mots optimal)

**Requête SQL de monitoring:**
```sql
-- Résumés des dernières 24h
SELECT 
  time_slot,
  articles_count,
  CASE WHEN audio_url IS NOT NULL THEN 'Oui' ELSE 'Non' END as audio_present,
  status,
  created_at
FROM audio_summaries 
WHERE user_id IS NULL 
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## ⚙️ Configuration

### Variables d'Environnement

```env
# IA pour résumés intelligents (recommandé)
OPENAI_API_KEY=sk-proj-xxx

# TTS Audio (obligatoire pour audio)
REPLICATE_API_TOKEN=r8_xxx

# Base de données
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Ajustement des Horaires

Modifier dans `/backend/services/audio-scheduler.js`:

```javascript
const SCHEDULED_TIMES = {
  MORNING: '7:00',    // Modifier ici
  AFTERNOON: '13:00', // Modifier ici
  EVENING: '20:00'    // Modifier ici
};
```

**⚠️ Redémarrer le backend après modification**

### Désactiver le Scheduler

Commenter dans `/backend/server.js`:

```javascript
// Démarrer le planificateur de résumés audio automatiques
// const { startScheduler } = require('./services/audio-scheduler');
// startScheduler();
```

## 🔧 Dépannage

### Le scheduler ne démarre pas

1. Vérifier les logs au démarrage du serveur
2. S'assurer que `node-cron` est installé : `npm list node-cron`
3. Vérifier la syntaxe des cron expressions

### Résumés non générés

1. Vérifier les logs à l'heure prévue
2. Tester génération manuelle : `node test-audio-scheduler.js`
3. Vérifier qu'il y a des articles dans les 24h

### Audio non généré

1. Vérifier `REPLICATE_API_TOKEN` dans `.env`
2. Tester connexion : `node services/replicate-kokoro-tts.js`
3. Vérifier crédits Replicate

### Widget ne s'affiche pas

1. Vérifier route `/api/audio/latest-public` : `curl http://localhost:3001/api/audio/latest-public`
2. Vérifier qu'au moins 1 résumé existe
3. Générer un résumé test si nécessaire

## 📈 Statistiques & Coûts

### Coûts par Jour

**3 résumés/jour:**
- GPT-4o-mini : 3 × $0.0003 = $0.0009
- Replicate Kokoro : 3 × $0.00022 = $0.00066
- **Total/jour** : ~$0.0016
- **Total/mois** : ~$0.048 (vs $150+ sans automatisation)

### Économie de Tokens

**Exemple avec 1000 utilisateurs:**
- **Sans automatisation** : 1000 × 3 = 3000 résumés/jour = $4.80/jour
- **Avec automatisation** : 3 résumés/jour = $0.0016/jour
- **Économie** : **99.97%** 🎉

## 🚀 Améliorations Futures

- [ ] Multi-langues (FR, EN, ZH) en parallèle
- [ ] Résumés thématiques (Politique, Sport, Économie)
- [ ] Notification push lors de nouveaux résumés
- [ ] Archivage automatique après 7 jours
- [ ] Statistiques d'écoute par créneau
- [ ] A/B testing sur horaires optimaux
- [ ] Résumés personnalisés hebdomadaires
- [ ] Export podcast RSS

## 📞 Support

**Logs à consulter:**
```bash
# Backend
tail -f backend/backend.log

# Scheduler spécifiquement
tail -f backend/backend.log | grep "🤖"
```

**Commandes utiles:**
```bash
# Test génération
node backend/test-audio-scheduler.js

# Récupérer résumés publics
curl http://localhost:3001/api/audio/public

# Générer manuellement
curl -X POST http://localhost:3001/api/audio/generate-manual -H "Content-Type: application/json" -d '{"timeSlot":"test"}'
```

---

**Version:** 3.0 - Système Automatisé
**Date:** 2025-10-07
**Auteur:** Gabon 24/7 Team
