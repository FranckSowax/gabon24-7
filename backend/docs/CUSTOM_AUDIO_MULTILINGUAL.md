# 🎨 Résumés Audio Personnalisés Multilingues

## Vue d'ensemble

Le système permet aux utilisateurs de créer des résumés audio personnalisés en sélectionnant **1 à 10 articles** de leur choix. Les résumés sont générés avec IA (GPT-4o-mini) dans 3 langues : **Français 🇫🇷, Anglais 🇺🇸 et Chinois 🇨🇳**.

## 🎯 Fonctionnalités

### Résumés Personnalisés Intelligents

**Avant (script basique) :**
```
Bonjour. Article 1: [titre]. [résumé brut]...
Article 2: [titre]. [résumé brut]...
```

**Maintenant (avec IA) :**
```
Bonjour et bienvenue dans votre résumé personnalisé. 

Aujourd'hui, nous allons explorer trois sujets d'actualité majeurs.

Commençons avec [transition naturelle]... [résumé cohérent article 1]

Ensuite, intéressons-nous à [transition fluide]... [résumé cohérent article 2]

Pour conclure, [transition engageante]... [résumé cohérent article 3]

Merci de votre écoute !
```

### Support Multilingue

- ✅ **Français** : Résumés professionnels avec ton radio français
- ✅ **Anglais** : Résumés professionnels avec ton podcast anglais
- ✅ **Chinois** : Résumés professionnels adaptés culture chinoise

### Génération Audio

- ✅ **Voix natives Kokoro** : `af_sarah` (FR), `af_bella` (EN), `af_nicole` (ZH)
- ✅ **Vitesse ajustable** : Lent (0.85x), Normal (1.0x), Rapide (1.2x)
- ✅ **Qualité haute** : 82M paramètres, naturel et fluide

## 🏗️ Architecture

### Backend Services

**1. Service de génération personnalisée**
- **Fichier** : `/backend/services/custom-summary-generator.js`
- **Fonction principale** : `generateCustomSummary(articles, language)`

**Workflow :**
```
1. Réception articles sélectionnés (3-5 max)
         ↓
2. Construction contexte pour GPT-4o-mini
   - Titre, source, résumé de chaque article
         ↓
3. Prompt adapté à la langue
   - Instructions professionnelles
   - Ton radio/podcast
   - Transitions naturelles
   - Maximum 400 mots
         ↓
4. Appel API OpenAI
   - Model: gpt-4o-mini
   - Temperature: 0.7
   - Max tokens: 800
         ↓
5. Résumé cohérent généré
   - Introduction accueillante
   - Présentation fluide des articles
   - Transitions entre sujets
   - Conclusion engageante
         ↓
6. Fallback si erreur
   - Résumé basique sans IA
```

**2. Route API**
- **Fichier** : `/backend/routes/audio.js`
- **Endpoint** : `POST /api/audio/generate-summary`

**Paramètres :**
```json
{
  "action": "custom",
  "userId": "uuid",
  "articleIds": ["id1", "id2", "id3"],
  "language": "fr|en|zh",
  "pace": "slow|normal|fast",
  "optimize": true,
  "sendWhatsApp": false
}
```

### Frontend

**Page** : `/frontend/src/app/audio/custom/page.tsx`

**Fonctionnalités UI :**
- ✅ Sélection d'articles (modale avec recherche)
- ✅ Sélecteur de langue (3 boutons avec drapeaux)
- ✅ Sélecteur de vitesse (dropdown)
- ✅ Aperçu articles sélectionnés
- ✅ Génération avec loader
- ✅ Historique personnel

## 📡 API

### POST /api/audio/generate-summary

Génère un résumé audio personnalisé.

**Request Body :**
```json
{
  "action": "custom",
  "userId": "9bb0138d-a587-4b46-a541-a309048bf97a",
  "articleIds": [
    "article-id-1",
    "article-id-2",
    "article-id-3"
  ],
  "language": "fr",
  "pace": "normal",
  "optimize": true,
  "sendWhatsApp": false
}
```

**Response :**
```json
{
  "success": true,
  "summaryId": "summary-uuid-xxx"
}
```

**Traitement asynchrone :**
Le résumé est généré en arrière-plan. Le statut peut être suivi via :
- Endpoint `/api/audio/history/:userId`
- Realtime Supabase (table `audio_summaries`)

**Statuts possibles :**
- `processing` : Génération du script IA
- `synthesizing_audio` : Génération audio Kokoro
- `uploading_audio` : Upload vers Supabase Storage
- `completed` : Terminé ✅
- `failed` : Échec ❌

### GET /api/audio/history/:userId

Récupère l'historique des résumés (daily + custom).

**Query Parameters :**
- Aucun

**Response :**
```json
{
  "success": true,
  "summaries": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "summary_type": "custom",
      "language": "fr",
      "article_ids": ["id1", "id2", "id3"],
      "articles_count": 3,
      "text_summary": "Bonjour et bienvenue...",
      "audio_url": "https://...",
      "audio_duration_seconds": 90,
      "status": "completed",
      "created_at": "2025-10-08T02:00:00Z"
    }
  ]
}
```

## 🎨 Prompts GPT par Langue

### Français
```
Tu es un journaliste professionnel. Crée un résumé audio captivant et cohérent 
à partir des 3 articles suivants.

Instructions:
- Commence par une introduction accueillante
- Présente chaque article de manière fluide et professionnelle
- Utilise un ton adapté à la radio/podcast
- Fais des transitions naturelles entre les sujets
- Conclus de manière engageante
- Maximum 400 mots pour rester concis

Articles:
[contexte articles]

Résumé audio professionnel:
```

### English
```
You are a professional journalist. Create a captivating and cohesive audio 
summary from the following 3 articles.

Instructions:
- Start with a welcoming introduction
- Present each article in a smooth and professional way
- Use a tone suitable for radio/podcast
- Make natural transitions between topics
- Conclude in an engaging manner
- Maximum 400 words to stay concise

Articles:
[articles context]

Professional audio summary:
```

### Chinese (中文)
```
您是一位专业记者。请根据以下3篇文章创建一个引人入胜且连贯的音频摘要。

说明:
- 以热情的介绍开始
- 以流畅和专业的方式呈现每篇文章
- 使用适合广播/播客的语气
- 在主题之间自然过渡
- 以引人入胜的方式结束
- 最多400字以保持简洁

文章:
[文章内容]

专业音频摘要:
```

## 🧪 Tests

### Test Complet

```bash
node backend/test-custom-multilingual.js
```

**Ce script :**
1. Récupère 3 articles récents
2. Génère résumés personnalisés en FR, EN, ZH
3. Vérifie le statut de chaque génération
4. Affiche l'historique avec détails
5. Statistiques et coûts

**Output attendu :**
```
🎨 Test résumés personnalisés multilingues (FR, EN, ZH)

1️⃣  Récupération d'articles pour test...
✅ 3 articles sélectionnés

2️⃣  Génération résumés personnalisés...

   📝 Test 🇫🇷 Français...
   ✅ 🇫🇷 Français: uuid-fr-xxx
      Temps: 5234ms
      Statut: processing
      Script: Bonjour et bienvenue dans votre résumé personnalisé...

   📝 Test 🇺🇸 English...
   ✅ 🇺🇸 English: uuid-en-xxx
      Temps: 4987ms
      Statut: processing
      Script: Hello and welcome to your personalized summary...

   📝 Test 🇨🇳 中文...
   ✅ 🇨🇳 中文: uuid-zh-xxx
      Temps: 5412ms
      Statut: processing
      Script: 您好，欢迎收听您的个性化摘要...

3️⃣  Vérification historique...

   📋 3 résumé(s) personnalisé(s) trouvé(s):

   1. 🇫🇷 FR
      ID: uuid-fr-xxx
      Articles: 3
      Statut: completed
      Audio: ✅ Disponible
      Script: Bonjour et bienvenue dans votre résumé personnalisé...

   2. 🇺🇸 EN
      ID: uuid-en-xxx
      Articles: 3
      Statut: completed
      Audio: ✅ Disponible

   3. 🇨🇳 ZH
      ID: uuid-zh-xxx
      Articles: 3
      Statut: completed
      Audio: ✅ Disponible

✅ Tests terminés !
```

### Test Manuel API

```bash
# Test résumé français
curl -X POST http://localhost:3001/api/audio/generate-summary \
  -H "Content-Type: application/json" \
  -d '{
    "action": "custom",
    "userId": "9bb0138d-a587-4b46-a541-a309048bf97a",
    "articleIds": ["id1", "id2", "id3"],
    "language": "fr",
    "pace": "normal"
  }'

# Test résumé anglais
curl -X POST http://localhost:3001/api/audio/generate-summary \
  -H "Content-Type: application/json" \
  -d '{
    "action": "custom",
    "userId": "9bb0138d-a587-4b46-a541-a309048bf97a",
    "articleIds": ["id1", "id2", "id3"],
    "language": "en",
    "pace": "normal"
  }'

# Test résumé chinois
curl -X POST http://localhost:3001/api/audio/generate-summary \
  -H "Content-Type: application/json" \
  -d '{
    "action": "custom",
    "userId": "9bb0138d-a587-4b46-a541-a309048bf97a",
    "articleIds": ["id1", "id2", "id3"],
    "language": "zh",
    "pace": "normal"
  }'
```

## 💰 Coûts et Crédits

### Système de Crédits

**Résumés personnalisés :**
- **Base** : 20 crédits (1-5 articles)
- **Articles supplémentaires** : +5 crédits/article (max 10 articles total)

**Exemples :**
- 3 articles : 20 crédits
- 5 articles : 20 crédits
- 6 articles : 25 crédits
- 8 articles : 35 crédits
- 10 articles : 45 crédits

### Coûts Réels

**Par résumé personnalisé :**
- GPT-4o-mini : ~$0.0005 (génération script)
- Replicate Kokoro : ~$0.00022 (audio)
- **Total** : ~**$0.00072**

**Comparaison :**
- OpenAI TTS seul : $0.015 (20x plus cher)
- Résumé basique sans IA : $0.00022 (audio uniquement)
- **Résumé IA + Kokoro** : $0.00072 (meilleur rapport qualité/prix)

### Rentabilité

**Avec 100 utilisateurs actifs/jour :**
- Sans IA : 100 × $0.00022 = $0.022/jour = $0.66/mois
- Avec IA : 100 × $0.00072 = $0.072/jour = $2.16/mois
- **Surcoût IA** : $1.50/mois pour qualité premium

**ROI :**
- Satisfaction utilisateur : ↑↑↑
- Professionnalisme : ↑↑↑
- Engagement : ↑↑
- Coût marginal : Très faible

## 📊 Qualité des Résumés

### Sans IA (Basique)

**Exemple :**
```
Bonjour. Article 1: Conseil des ministres. Le président a procédé à 
plusieurs nominations. Article 2: Prix du carburant. Le gouvernement 
annonce une hausse. Article 3: Match de football. L'équipe nationale...
```

**Problèmes :**
- ❌ Ton robotique
- ❌ Pas de transitions
- ❌ Informations brutes
- ❌ Pas de contexte

### Avec IA (Premium)

**Exemple :**
```
Bonjour et bienvenue dans votre résumé personnalisé de l'actualité gabonaise.

Commençons par une actualité politique majeure. Lors du Conseil des ministres 
d'hier, le président a procédé à plusieurs nominations stratégiques, notamment 
à la tête du ministère de l'Économie. Ces changements interviennent dans un 
contexte économique particulièrement tendu.

Justement, parlons économie. Le gouvernement a annoncé une hausse des prix du 
carburant qui suscite de vives réactions dans la population. Cette décision, 
bien que controversée, reflète l'impact des cours mondiaux sur notre économie.

Sur une note plus positive, terminons avec le sport. L'équipe nationale de 
football a remporté une belle victoire hier soir, offrant un moment de fierté 
collective à tous les Gabonais.

Voilà pour ce tour d'horizon de l'actualité. Merci de votre écoute et à bientôt !
```

**Avantages :**
- ✅ Ton professionnel
- ✅ Transitions fluides
- ✅ Contexte et analyse
- ✅ Structure narrative
- ✅ Introduction et conclusion

## 🔧 Configuration

### Variables d'Environnement

```env
# IA pour résumés intelligents (recommandé)
OPENAI_API_KEY=sk-proj-xxxxx

# TTS Audio (obligatoire)
REPLICATE_API_TOKEN=r8_xxxxx

# Base de données
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Ajustement des Prompts

**Modifier le ton :**
```javascript
// /backend/services/custom-summary-generator.js ligne 50
temperature: 0.7, // 0.5 = plus conservateur, 0.9 = plus créatif
```

**Modifier la longueur :**
```javascript
// ligne 47
prompt = `... Maximum 400 mots ...` // Ajuster selon besoin
// ligne 51
max_tokens: 800 // Ajuster en conséquence
```

**Modifier le style :**
```javascript
// Système prompt ligne 53-57
role: 'system',
content: 'Tu es un journaliste expert en [STYLE]...'
// Exemples: investigation, vulgarisation, analyse, etc.
```

## 🐛 Dépannage

### Problème : Résumés trop courts

**Cause :** Prompt ou max_tokens trop restrictifs

**Solution :**
```javascript
// Augmenter max_tokens
max_tokens: 1000 // au lieu de 800

// Ajuster prompt
prompt = `... Maximum 500 mots ...` // au lieu de 400
```

### Problème : Résumés de mauvaise qualité

**Cause :** Articles sources incomplets

**Solution :**
```javascript
// Vérifier que les articles ont des résumés
const articlesContext = articles.map((a, idx) => {
  const summary = a.ai_summary || a.summary || a.title;
  if (summary.length < 50) {
    console.warn(`⚠️  Article ${a.id} a un résumé très court`);
  }
  return `...`;
});
```

### Problème : Génération lente

**Cause :** Appels API séquentiels

**Solution :**
- Utiliser cache pour résumés similaires
- Optimiser prompts (moins de tokens)
- Considérer modèle plus rapide (gpt-3.5-turbo)

### Problème : Langue incorrecte

**Cause :** Paramètre language non passé

**Vérifier :**
1. Frontend envoie bien `language` dans body
2. Backend sauvegarde dans colonne `language`
3. Prompt utilise la bonne langue

## 📈 Métriques de Production

### Statistiques à Suivre

```sql
-- Résumés personnalisés par langue (7 derniers jours)
SELECT 
  language,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN audio_url IS NOT NULL THEN 1 END) as with_audio,
  AVG(articles_count) as avg_articles
FROM audio_summaries 
WHERE summary_type = 'custom'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY language
ORDER BY total DESC;
```

**Résultat attendu :**
| language | total | completed | with_audio | avg_articles |
|----------|-------|-----------|------------|--------------|
| fr       | 145   | 142       | 142        | 3.2          |
| en       | 38    | 37        | 37         | 3.5          |
| zh       | 12    | 12        | 12         | 3.1          |

### Dashboard Utilisateur

```sql
-- Top utilisateurs résumés custom
SELECT 
  user_id,
  COUNT(*) as total_custom,
  COUNT(DISTINCT language) as languages_used,
  AVG(articles_count) as avg_articles
FROM audio_summaries 
WHERE summary_type = 'custom'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_custom DESC
LIMIT 10;
```

## 🚀 Améliorations Futures

- [ ] Résumés thématiques (Sport, Économie, Politique séparé)
- [ ] Analyse sentiment pour adapter le ton
- [ ] Résumés comparatifs (Avant/Après)
- [ ] Résumés hebdomadaires automatiques
- [ ] Export MP3 avec métadonnées podcast
- [ ] Transcription avec timestamps
- [ ] Support d'autres langues (Espagnol, Portugais)
- [ ] Cache intelligent des résumés similaires
- [ ] A/B testing sur qualité voix
- [ ] Génération batch (plusieurs résumés en parallèle)

---

**Version:** 5.0 - Résumés Personnalisés Multilingues avec IA
**Date:** 2025-10-08
**Auteur:** Gabon 24/7 Team
