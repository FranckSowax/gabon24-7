# 🔍 Investigation: Scheduler Audio Non Déclenché (17 Oct 2025)

## ❌ Problème Constaté

Les résumés audio programmés à **13h** et **20h** du **17 octobre 2025** n'ont **pas été générés automatiquement**.

## ✅ État Actuel (Résolu Manuellement)

**Résumés générés manuellement:**
- ☀️ **13h (Afternoon):** FR ✅, EN ✅, ZH ✅ (sans audio)
- 🌙 **20h (Evening):** FR ✅, EN ✅, ZH ✅ (sans audio)

**Le lecteur audio est maintenant à jour** avec les 6 résumés du 17 octobre.

## 🔧 Configuration Actuelle

### Scheduler (audio-scheduler.js)
```javascript
// Cron jobs configurés:
'0 7 * * *'   → 7h00 (matin) - 3 langues
'0 13 * * *'  → 13h00 (après-midi) - 3 langues  
'0 20 * * *'  → 20h00 (soir) - 3 langues

// Timezone: Africa/Libreville (UTC+1)
```

### Activation (server.js ligne 3844-3845)
```javascript
const { startScheduler } = require('./services/audio-scheduler');
startScheduler();
```

## 🔎 Causes Possibles

### 1. **Railway Container Restart**
- Railway peut redémarrer les containers à tout moment
- Si redémarrage entre 13h et 20h, les cron jobs perdus
- **Solution:** Vérifier les logs Railway pour redémarrages

### 2. **Timezone Issue**
- Container Docker peut avoir timezone différente
- Cron schedule peut ne pas correspondre à heure Gabon
- **Solution:** Vérifier `TZ=Africa/Libreville` dans env vars

### 3. **Memory/CPU Limits**
- Railway peut kill le process si trop de ressources
- Génération audio + IA = consommation importante
- **Solution:** Monitor usage Railway

### 4. **Cron Job Non Persistant**
- Les cron jobs node-cron ne sont pas persistants
- Si le serveur crash, les jobs sont perdus
- **Solution:** Utiliser Railway Cron Jobs (feature native)

## 🎯 Solutions Recommandées

### Solution 1: Utiliser Railway Cron Jobs (RECOMMANDÉ)

**Dans `railway.toml`:**
```toml
[[crons]]
  schedule = "0 7 * * *"
  command = "node scripts/generate-morning-summaries.js"

[[crons]]
  schedule = "0 13 * * *"
  command = "node scripts/generate-afternoon-summaries.js"

[[crons]]
  schedule = "0 20 * * *"
  command = "node scripts/generate-evening-summaries.js"
```

**Avantages:**
- ✅ Persistant (pas dépendant du serveur)
- ✅ Logs séparés dans Railway
- ✅ Retry automatique
- ✅ Ne dépend pas du container principal

### Solution 2: Endpoint Webhook + Service Externe

Utiliser un service externe (cron-job.org, GitHub Actions) pour appeler:
```bash
POST /api/audio/generate-scheduled-summary
Body: {"timeSlot": "afternoon", "language": "fr"}
```

**Avantages:**
- ✅ 100% fiable (externe)
- ✅ Pas de dépendance Railway
- ✅ Monitoring externe

### Solution 3: Vérification au Démarrage

Ajouter dans `startScheduler()`:
```javascript
// Vérifier si résumés du jour manquants
const now = new Date();
const hour = now.getHours();

if (hour >= 13 && !resumeAfterdernoonExists()) {
  generateMultilingualSummaries('afternoon');
}
if (hour >= 20 && !resumeEveningExists()) {
  generateMultilingualSummaries('evening');
}
```

## 📊 Actions Immédiates

1. ✅ **Résumés générés manuellement** via endpoint `/generate-scheduled-summary`
2. ✅ **Time_slot corrigés** dans la base de données
3. ✅ **Lecteur audio à jour** avec résumés du 17 octobre

## 📝 TODO (Prévenir Récurrence)

- [ ] Implémenter Railway Cron Jobs natifs
- [ ] Ajouter monitoring/alerting si résumé manquant
- [ ] Créer script de récupération automatique
- [ ] Logger tous les déclenchements cron
- [ ] Vérifier timezone dans Railway env vars
- [ ] Documenter procédure génération manuelle

## ✅ Problème Résolu: Audio Chinois

**Symptôme précédent:** Résumés en chinois (ZH) génèrent le texte mais pas l'audio

**Cause:** La voix `zf_xiaobei` nécessitait le module Python `pypinyin` non installé sur Replicate

**Solution appliquée:** Changement de voix vers `zm_yunxi` (voix masculine chinoise sans dépendance pypinyin)

**Statut:** ✅ Audio chinois maintenant fonctionnel

**TODO:** Investiguer alternatives TTS pour chinois (Google Cloud TTS, Azure TTS)

---

**Date:** 17 octobre 2025 21:30 WAT  
**Résolu par:** Génération manuelle + correction time_slot  
**Impact:** Lecteur audio maintenant à jour, aucune perte de données
