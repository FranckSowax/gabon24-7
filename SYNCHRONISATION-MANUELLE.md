# 🔄 SYNCHRONISATION MANUELLE DU CONTENU

## ⚠️ PROBLÈME IDENTIFIÉ

Les **crons automatiques ne fonctionnent pas sur Railway**. Il faut lancer manuellement :
1. **Journal TV** : Extraction depuis RSS YouTube
2. **Résumés audio** : Génération quotidienne (FR, EN, ZH)

## 📊 ÉTAT ACTUEL (19 octobre 2025)

### Journal TV
- ❌ **Dernier extrait :** 17 octobre à 21h56
- ⏰ **Retard :** 2 jours
- 📺 **Vidéos manquées :** Journaux 18 et 19 octobre

### Résumés Audio
- ❌ **Générés :** 0 (aucun)
- 📅 **Jamais lancés :** Table `audio_summaries` vide

## 🚀 SOLUTION : SCRIPT SYNCHRONISATION COMPLÈTE

### Script créé : `sync-all-content.js`

**Ce qu'il fait :**
1. ✅ Extrait dernier journal TV depuis RSS
2. ✅ Génère 3 résumés audio (FR, EN, ZH)
3. ✅ Upload audio vers Supabase
4. ✅ Logs détaillés de chaque étape

**Durée totale :** ~2-3 minutes

## 🎯 MÉTHODE 1 : VIA RAILWAY CLI (RECOMMANDÉ)

### Installation Railway CLI
```bash
# macOS
brew install railway

# Windows (PowerShell)
iwr https://railway.app/install.ps1 | iex

# Linux
curl -fsSL https://railway.app/install.sh | sh
```

### Connexion
```bash
railway login
```

### Lancer la synchronisation
```bash
# Se placer dans le projet backend
cd /path/to/gabon24-7/backend

# Lancer le script
railway run node scripts/sync-all-content.js
```

### Exemple sortie attendue
```
═══════════════════════════════════════════════════════════════════════════════
🔄 SYNCHRONISATION COMPLÈTE DU CONTENU
═══════════════════════════════════════════════════════════════════════════════
🕐 19/10/2025 15:49:23 (WAT)

📺 ÉTAPE 1/2: EXTRACTION JOURNAUX TV
────────────────────────────────────────────────────────────────────────────────
🔄 Extraction du dernier journal depuis RSS...
📺 EXTRACTION DU JOURNAL TV DEPUIS RSS
════════════════════════════════════════════════════════════════════════════════
🔄 Récupération du flux: https://rss.app/feeds/8Zm0ezBRaaD2NiOF.xml
✅ 10 vidéos trouvées dans le flux RSS

📊 ANALYSE DES VIDÉOS:
1. 19/10 13:30 | Image: ✅ OUI
   📰 Journal Télévisé de 13h du 19 octobre 2025.
   🖼️  https://i.ytimg.com/vi/xxxx/maxresdefault.jpg

✅ Journal TV extrait avec succès

🔊 ÉTAPE 2/2: GÉNÉRATION RÉSUMÉS AUDIO
────────────────────────────────────────────────────────────────────────────────

🌍 Génération résumé FR...
✅ Résumé FR généré
   📝 Texte: L'actualité gabonaise du 19 octobre 2025...
   🎵 Audio: https://ykytsadwfqoyusleoflf.supabase.co/storage/v1/object/public/...

🌍 Génération résumé EN...
✅ Résumé EN généré
   📝 Texte: Gabon's news for October 19, 2025...
   🎵 Audio: https://ykytsadwfqoyusleoflf.supabase.co/storage/v1/object/public/...

🌍 Génération résumé ZH...
✅ Résumé ZH généré
   📝 Texte: 2025年10月19日加蓬新闻...
   🎵 Audio: https://ykytsadwfqoyusleoflf.supabase.co/storage/v1/object/public/...

═══════════════════════════════════════════════════════════════════════════════
📊 RÉSUMÉ DE LA SYNCHRONISATION:
────────────────────────────────────────────────────────────────────────────────
   ✅ Réussis: 4
   ❌ Échoués: 0
═══════════════════════════════════════════════════════════════════════════════

🎉 Synchronisation terminée avec succès !

🔗 Vérifier sur:
   📺 Journal TV: https://gabon24-7.netlify.app/
   🔊 Résumés audio: https://gabon24-7.netlify.app/audio/daily
```

## 🎯 MÉTHODE 2 : VIA INTERFACE RAILWAY

### Étapes
1. Aller sur https://railway.app
2. Sélectionner projet **gabon24-7-production**
3. Cliquer sur service **Backend**
4. Onglet **"Deployments"**
5. Cliquer **"..."** → **"Run Command"**
6. Taper : `node scripts/sync-all-content.js`
7. Appuyer **Enter**
8. Attendre 2-3 minutes

### Screenshot
```
┌─────────────────────────────────────────┐
│ Railway > gabon24-7 > Backend           │
│                                         │
│ Deployments  Variables  Settings  ...  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ Run Command                       │  │
│ │                                   │  │
│ │ node scripts/sync-all-content.js  │  │
│ │                                   │  │
│ │           [Execute]               │  │
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## 🎯 MÉTHODE 3 : VIA API BACKEND (ALTERNATIVE)

### Appel API direct
```bash
# Extraction journal TV seul
curl -X POST "https://gabon24-7-production.up.railway.app/api/youtube/extract"

# Génération résumé FR
curl -X POST "https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}'

# Génération résumé EN
curl -X POST "https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'

# Génération résumé ZH
curl -X POST "https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary" \
  -H "Content-Type: application/json" \
  -d '{"language":"zh"}'
```

## ⏰ FRÉQUENCE RECOMMANDÉE

### Journal TV
- **Idéal :** 3 fois/jour (après journaux 13h, 20h, 23h)
- **Minimum :** 1 fois/jour (le soir)

### Résumés Audio
- **Idéal :** 3 fois/jour (créneaux 7h, 13h, 20h)
- **Minimum :** 1 fois/jour (matin)

## 🔍 VÉRIFICATION RÉSULTATS

### Journal TV
```sql
-- Vérifier dernier journal extrait
SELECT video_id, title, published_at, extracted_at 
FROM youtube_cache 
ORDER BY extracted_at DESC 
LIMIT 3;
```

**Attendu :**
```
video_id     | title                              | published_at        | extracted_at
-------------|------------------------------------|--------------------|------------------
xxxx         | Journal 13h du 19 octobre 2025     | 2025-10-19 13:30   | 2025-10-19 15:50
yyyy         | Journal 20h du 18 octobre 2025     | 2025-10-18 20:24   | 2025-10-19 15:50
```

### Résumés Audio
```sql
-- Vérifier résumés générés
SELECT language, time_slot, status, created_at 
FROM audio_summaries 
ORDER BY created_at DESC 
LIMIT 5;
```

**Attendu :**
```
language | time_slot  | status    | created_at
---------|-----------|-----------|------------------
fr       | afternoon | completed | 2025-10-19 15:50
en       | afternoon | completed | 2025-10-19 15:51
zh       | afternoon | completed | 2025-10-19 15:52
```

### Frontend
1. **Journal TV :** Aller sur https://gabon24-7.netlify.app/
   - Widget "📺 Journal TV" doit afficher dernière vidéo
   
2. **Résumés audio :** Aller sur https://gabon24-7.netlify.app/audio/daily
   - Onglets FR / EN / ZH doivent avoir contenu
   - Lecteur audio doit être présent

## 🐛 DÉPANNAGE

### Erreur : "Module not found"
```bash
# Installer dépendances
cd backend
npm install
```

### Erreur : "REPLICATE_API_TOKEN missing"
```bash
# Vérifier variables d'environnement Railway
railway variables
```

### Erreur : "SUPABASE_SERVICE_ROLE_KEY missing"
```bash
# Vérifier dans Railway dashboard
# Settings > Variables
```

### Journal TV extrait mais pas visible
```sql
-- Vérifier is_active
SELECT video_id, title, is_active 
FROM youtube_cache 
ORDER BY extracted_at DESC 
LIMIT 1;

-- Si is_active = false, activer
UPDATE youtube_cache 
SET is_active = true 
WHERE video_id = 'xxx';
```

### Résumé généré mais pas d'audio
- **Cause :** `REPLICATE_API_TOKEN` manquant ou invalide
- **Solution :** Ajouter token dans variables Railway
- **Note :** Texte sera généré, audio manquant

## 📝 NOTES IMPORTANTES

1. **Pas de cron automatique** : Railway ne supporte pas les crons intégrés
2. **Lancement manuel** : Utiliser Railway CLI ou interface web
3. **Alternative future** : Utiliser un service externe (GitHub Actions, cron-job.org)
4. **Coût** : ~$0.10-0.20 par synchronisation complète (Replicate API)
5. **Durée** : 2-3 minutes pour tout synchroniser

## 🔗 RESSOURCES

- **Railway CLI :** https://docs.railway.app/develop/cli
- **Replicate API :** https://replicate.com/account/api-tokens
- **Supabase Dashboard :** https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf

## ✅ CHECKLIST QUOTIDIENNE

- [ ] Lancer `railway run node scripts/sync-all-content.js`
- [ ] Vérifier journal TV sur site
- [ ] Vérifier résumés audio sur /audio/daily
- [ ] Vérifier logs Railway pour erreurs

---

**Dernière mise à jour :** 19 octobre 2025
**Script créé :** `backend/scripts/sync-all-content.js`
