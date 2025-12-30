# 🌍 Système de Résumés Audio Multilingues

## Vue d'ensemble

Le système génère automatiquement **9 résumés audio par jour** :
- **3 créneaux horaires** : 7h, 13h, 20h
- **3 langues** : Français 🇫🇷, Anglais 🇺🇸, Chinois 🇨🇳
- **Total** : 3 × 3 = 9 résumés/jour

Chaque résumé analyse TOUS les articles des dernières 24h avec un accent sur la politique.

## 🎯 Fonctionnalités

### Génération Automatique

**Chaque créneau horaire (7h, 13h, 20h) génère :**
1. 🇫🇷 Résumé en **Français** (voix `af_sarah`)
2. 🇺🇸 Résumé en **Anglais** (voix `af_bella`)
3. 🇨🇳 Résumé en **Chinois** (voix `af_nicole`)

**Processus :**
- Les 3 générations se font séquentiellement avec pause de 2s entre chaque
- Même articles analysés, résumés traduits/adaptés par langue
- Audio généré avec voix native appropriée (Replicate Kokoro)

### Widget Frontend

Le widget `AudioSummaryWidget.tsx` permet :
- ✅ **Sélection de langue** : Boutons FR/EN/ZH avec drapeaux
- ✅ **Chargement dynamique** : Résumé change selon la langue sélectionnée
- ✅ **État visuel** : Langue active en bleu, autres en gris
- ✅ **Réactivité** : Mise à jour automatique lors du changement

## 🗄️ Structure de Données

### Colonne `language` dans `audio_summaries`

```sql
ALTER TABLE audio_summaries 
ADD COLUMN language VARCHAR(5) DEFAULT 'fr';

-- Index pour performances
CREATE INDEX idx_audio_summaries_language ON audio_summaries(language);
CREATE INDEX idx_audio_summaries_public_lang_slot 
ON audio_summaries(user_id, language, time_slot) 
WHERE user_id IS NULL;
```

**Valeurs possibles :**
- `'fr'` : Français
- `'en'` : Anglais (English)
- `'zh'` : Chinois (中文)

## 📡 API Endpoints Mis à Jour

### GET /api/audio/public

Récupère les résumés publics avec filtres optionnels.

**Query Parameters :**
- `limit` (number) : Nombre max de résumés (défaut: 10)
- `timeSlot` (string) : Filtrer par créneau (`morning`, `afternoon`, `evening`)
- `language` (string) : **NOUVEAU** - Filtrer par langue (`fr`, `en`, `zh`)

**Exemples :**
```bash
# Tous les résumés français
curl "http://localhost:3001/api/audio/public?language=fr"

# Résumés du matin en anglais
curl "http://localhost:3001/api/audio/public?timeSlot=morning&language=en"

# 5 derniers résumés chinois
curl "http://localhost:3001/api/audio/public?language=zh&limit=5"
```

### GET /api/audio/latest-public

Récupère le dernier résumé d'une langue spécifique.

**Query Parameters :**
- `language` (string) : **NOUVEAU** - Langue du résumé (défaut: `fr`)

**Exemples :**
```bash
# Dernier résumé français
curl "http://localhost:3001/api/audio/latest-public?language=fr"

# Dernier résumé anglais
curl "http://localhost:3001/api/audio/latest-public?language=en"

# Dernier résumé chinois
curl "http://localhost:3001/api/audio/latest-public?language=zh"
```

**Réponse :**
```json
{
  "success": true,
  "summary": {
    "id": "uuid",
    "user_id": null,
    "summary_type": "daily",
    "time_slot": "morning",
    "language": "fr",
    "articles_count": 45,
    "text_summary": "Bonjour. Voici votre résumé...",
    "audio_url": "https://...",
    "audio_duration_seconds": 120,
    "status": "completed",
    "created_at": "2025-10-08T07:00:00Z"
  }
}
```

### GET /api/audio/latest-multilingual ⭐ NOUVEAU

Récupère les derniers résumés dans **toutes les langues** en un seul appel.

**Aucun paramètre requis.**

**Exemple :**
```bash
curl "http://localhost:3001/api/audio/latest-multilingual"
```

**Réponse :**
```json
{
  "success": true,
  "summaries": {
    "fr": {
      "id": "uuid-fr",
      "time_slot": "evening",
      "language": "fr",
      "articles_count": 52,
      "text_summary": "Bonsoir. Voici le résumé...",
      "audio_url": "https://...",
      "status": "completed"
    },
    "en": {
      "id": "uuid-en",
      "time_slot": "evening",
      "language": "en",
      "articles_count": 52,
      "text_summary": "Good evening. Here is the summary...",
      "audio_url": "https://...",
      "status": "completed"
    },
    "zh": {
      "id": "uuid-zh",
      "time_slot": "evening",
      "language": "zh",
      "articles_count": 52,
      "text_summary": "晚上好。这是摘要...",
      "audio_url": "https://...",
      "status": "completed"
    }
  },
  "count": 3
}
```

**Utilité :**
- Dashboard admin multilingue
- Comparaison des versions linguistiques
- Sélecteur de langue intelligent

## 🔄 Workflow de Génération

### À chaque créneau (7h, 13h, 20h)

```
1. Cron trigger
         ↓
2. Fonction generateMultilingualSummaries('morning')
         ↓
3. Pour chaque langue (fr, en, zh):
   ├─ Récupération articles 24h
   ├─ Analyse IA GPT-4o-mini
   │  └─ Prompt adapté à la langue
   ├─ Génération audio Kokoro
   │  └─ Voix native (af_sarah, af_bella, af_nicole)
   ├─ Upload Supabase Storage
   └─ Sauvegarde en base (user_id=NULL, language=XX)
         ↓
4. Pause 2s entre chaque langue
         ↓
5. Log: "✅ 3 résumé(s) créé(s) pour morning"
```

### Logs Backend

**Au démarrage :**
```
⏰ Démarrage du planificateur de résumés audio automatiques
   - 7h00: Résumés du matin (FR, EN, ZH)
   - 13h00: Résumés de l'après-midi (FR, EN, ZH)
   - 20h00: Résumés du soir (FR, EN, ZH)

✅ Planificateur actif - Mode multilingue (FR/EN/ZH)
```

**À chaque génération :**
```
🌅 Déclenchement résumés du matin (7h) - Multilingue

🤖 [08/10/2025 07:00:00] Génération morning [Français]
📰 52 articles analysés [Français]
✅ Résumé créé [Français]: uuid-fr-xxx

🤖 [08/10/2025 07:00:02] Génération morning [English]
📰 52 articles analysés [English]
✅ Résumé créé [English]: uuid-en-xxx

🤖 [08/10/2025 07:00:04] Génération morning [中文]
📰 52 articles analysés [中文]
✅ Résumé créé [中文]: uuid-zh-xxx

✅ 3 résumé(s) créé(s) pour morning
```

## 🎨 Intégration Frontend

### Sélecteur de Langue dans le Widget

```tsx
// État
const [selectedLanguage, setSelectedLanguage] = useState<string>('fr')

// Boutons de sélection
<div className="flex gap-2 mb-4">
  {Object.entries(LANGUAGE_LABELS).map(([lang, info]) => (
    <button
      key={lang}
      onClick={() => setSelectedLanguage(lang)}
      className={selectedLanguage === lang ? 'bg-blue-600 text-white' : 'bg-white'}
    >
      <span>{info.flag}</span>
      <span>{info.label}</span>
    </button>
  ))}
</div>

// Chargement automatique lors du changement
useEffect(() => {
  fetchLatestSummary() // Utilise selectedLanguage
}, [selectedLanguage])
```

### Labels et Drapeaux

```typescript
const LANGUAGE_LABELS: Record<string, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇺🇸', label: 'English' },
  zh: { flag: '🇨🇳', label: '中文' }
}
```

## 🧪 Tests

### Test Complet Multilingue

```bash
node backend/test-multilingual-audio.js
```

**Ce script :**
1. Génère manuellement les 3 langues
2. Vérifie chaque résumé par langue
3. Test l'endpoint `/latest-multilingual`
4. Affiche les statistiques et coûts

**Output attendu :**
```
🌍 Test génération résumés multilingues

1️⃣  Génération manuelle des 3 langues...

   Génération 🇫🇷 Français...
   ✅ 🇫🇷 Français: uuid-fr-xxx
   
   Génération 🇺🇸 English...
   ✅ 🇺🇸 English: uuid-en-xxx
   
   Génération 🇨🇳 中文...
   ✅ 🇨🇳 中文: uuid-zh-xxx

✅ 3 résumé(s) créé(s)

2️⃣  Récupération des derniers résumés par langue...

   🇫🇷 Français:
      ID: uuid-fr-xxx
      Statut: completed
      Articles: 52
      Script: Bonjour. Voici votre résumé d'actualités...
      Audio: ✅ Disponible

   🇺🇸 English:
      ID: uuid-en-xxx
      Statut: completed
      Articles: 52
      Script: Hello. Here is your news summary...
      Audio: ✅ Disponible

   🇨🇳 中文:
      ID: uuid-zh-xxx
      Statut: completed
      Articles: 52
      Script: 您好。这是您的新闻摘要...
      Audio: ✅ Disponible

3️⃣  Test endpoint /api/audio/latest-multilingual...

   ✅ 3 langue(s) disponible(s):
      🇫🇷 Français: evening - completed
      🇺🇸 English: evening - completed
      🇨🇳 中文: evening - completed

✅ Tests terminés !
```

### Tests Manuels API

```bash
# Test FR
curl "http://localhost:3001/api/audio/latest-public?language=fr"

# Test EN
curl "http://localhost:3001/api/audio/latest-public?language=en"

# Test ZH
curl "http://localhost:3001/api/audio/latest-public?language=zh"

# Test multilingue
curl "http://localhost:3001/api/audio/latest-multilingual"
```

## 💰 Coûts et Économies

### Coûts par Jour

**9 résumés/jour (3 créneaux × 3 langues) :**
- GPT-4o-mini : 9 × $0.0003 = **$0.0027/jour**
- Replicate Kokoro : 9 × $0.00022 = **$0.00198/jour**
- **Total/jour** : ~**$0.00468**
- **Total/mois** : ~**$0.14**

### Comparaison avec Système Non-Automatisé

**Avec 1000 utilisateurs actifs :**

| Scénario | Résumés/jour | Coût/jour | Coût/mois |
|----------|--------------|-----------|-----------|
| **Sans automatisation** | 3000 (1000 users × 3) | $1.56 | $46.80 |
| **Avec automatisation FR uniquement** | 3 (public) | $0.00156 | $0.05 |
| **Avec automatisation Multilingue** | 9 (3 langues) | $0.00468 | $0.14 |

**Économie avec multilingue :**
- vs Sans automatisation : **99.70%** d'économie
- Coût additionnel vs FR seul : **+$0.09/mois** pour 2 langues supplémentaires

**ROI Multilingue :**
- Coût marginal : $0.09/mois pour EN + ZH
- Valeur ajoutée : Accessibilité internationale, utilisateurs non-francophones
- **Rentable dès 1 utilisateur non-francophone/mois** 🎯

## 📊 Statistiques de Production

### Métriques à Suivre

```sql
-- Résumés par langue (dernières 24h)
SELECT 
  language,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN audio_url IS NOT NULL THEN 1 END) as with_audio
FROM audio_summaries 
WHERE user_id IS NULL 
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY language
ORDER BY language;
```

**Résultat attendu :**
| language | total | completed | with_audio |
|----------|-------|-----------|------------|
| en       | 3     | 3         | 3          |
| fr       | 3     | 3         | 3          |
| zh       | 3     | 3         | 3          |

### Dashboard Admin (À implémenter)

```sql
-- Vue d'ensemble multilingue
CREATE VIEW audio_summary_stats AS
SELECT 
  time_slot,
  language,
  DATE(created_at) as date,
  COUNT(*) as count,
  AVG(articles_count) as avg_articles,
  AVG(audio_duration_seconds) as avg_duration
FROM audio_summaries 
WHERE user_id IS NULL
GROUP BY time_slot, language, DATE(created_at)
ORDER BY date DESC, time_slot, language;
```

## 🔧 Configuration Avancée

### Ajouter une Nouvelle Langue

**1. Mise à jour du Scheduler :**
```javascript
// /backend/services/audio-scheduler.js
async function generateMultilingualSummaries(timeSlot) {
  const languages = ['fr', 'en', 'zh', 'es']; // Ajouter 'es' pour espagnol
  // ...
}
```

**2. Mapping Voix Kokoro :**
```javascript
// /backend/services/replicate-kokoro-tts.js
const voiceMap = {
  'fr': 'af_sarah',
  'en': 'af_bella',
  'zh': 'af_nicole',
  'es': 'af_spanish_voice' // À déterminer selon Kokoro
};
```

**3. Frontend Labels :**
```typescript
// /frontend/src/components/widgets/AudioSummaryWidget.tsx
const LANGUAGE_LABELS = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇺🇸', label: 'English' },
  zh: { flag: '🇨🇳', label: '中文' },
  es: { flag: '🇪🇸', label: 'Español' }
}
```

### Désactiver une Langue

**Option 1 - Scheduler :**
```javascript
const languages = ['fr', 'en']; // Retirer 'zh' temporairement
```

**Option 2 - Base de données :**
```sql
-- Désactiver génération chinoise (soft delete)
UPDATE audio_summaries 
SET status = 'disabled' 
WHERE language = 'zh' AND user_id IS NULL;
```

## 🐛 Dépannage

### Problème : Une langue ne se génère pas

**Vérifier :**
1. Logs backend au moment du cron : `tail -f backend/backend.log | grep "🤖"`
2. Erreurs spécifiques à la langue
3. Support de la voix par Kokoro

**Solution :**
```bash
# Test génération manuelle
curl -X POST http://localhost:3001/api/audio/generate-manual \
  -H "Content-Type: application/json" \
  -d '{"timeSlot":"test","language":"zh"}'
```

### Problème : Widget affiche langue incorrecte

**Vérifier :**
1. État `selectedLanguage` dans le composant
2. API retourne bien `language` dans la réponse
3. Filtrage côté serveur fonctionne

**Debug :**
```javascript
// Dans AudioSummaryWidget.tsx
console.log('Language sélectionnée:', selectedLanguage);
console.log('Résumé chargé:', latestSummary?.language);
```

### Problème : Traductions de mauvaise qualité

**Cause :** GPT génère le résumé dans la mauvaise langue

**Solution :** Vérifier les prompts dans `daily-news-analyzer.js`
```javascript
if (language === 'en') {
  prompt = `You are a journalist... Generate in ENGLISH...`;
} else if (language === 'zh') {
  prompt = `您是记者... 用中文生成...`;
}
```

## 📞 Support

**Commandes utiles :**
```bash
# Vérifier résumés multilingues
curl "http://localhost:3001/api/audio/latest-multilingual" | jq

# Tester génération
node backend/test-multilingual-audio.js

# Voir logs en direct
tail -f backend/backend.log | grep -E "(🇫🇷|🇺🇸|🇨🇳)"
```

**Requêtes SQL utiles :**
```sql
-- Derniers résumés par langue
SELECT language, time_slot, status, created_at 
FROM audio_summaries 
WHERE user_id IS NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- Performance par langue
SELECT 
  language,
  COUNT(*) as total,
  ROUND(AVG(audio_duration_seconds), 2) as avg_duration,
  COUNT(CASE WHEN audio_url IS NOT NULL THEN 1 END) as with_audio
FROM audio_summaries 
WHERE user_id IS NULL
GROUP BY language;
```

---

**Version:** 4.0 - Système Multilingue
**Date:** 2025-10-08
**Auteur:** Gabon 24/7 Team
