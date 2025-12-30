# 📜 Scripts Cron - Résumés Audio Automatiques

## 🎯 Vue d'ensemble

Ces scripts gèrent la génération automatique des résumés audio multilingues (FR, EN, ZH) via Railway Cron Jobs.

## ⏰ Horaires de Génération

| Heure | Script | Time Slot | Langues |
|-------|--------|-----------|---------|
| **7h00** | `generate-morning-summaries.js` | `morning` | 🇫🇷 🇺🇸 🇨🇳 |
| **13h00** | `generate-afternoon-summaries.js` | `afternoon` | 🇫🇷 🇺🇸 🇨🇳 |
| **20h00** | `generate-evening-summaries.js` | `evening` | 🇫🇷 🇺🇸 🇨🇳 |

**Timezone:** `Africa/Libreville` (WAT = UTC+1)

## 📁 Structure des Scripts

```
backend/scripts/
├── generate-morning-summaries.js      # 🌅 Résumés 7h
├── generate-afternoon-summaries.js    # ☀️  Résumés 13h
├── generate-evening-summaries.js      # 🌙 Résumés 20h
├── monitor-cron-jobs.js               # 📊 Monitoring
└── README.md                          # 📖 Documentation
```

## 🚀 Configuration Railway

Le fichier `railway.toml` à la racine configure les cron jobs:

```toml
[[crons]]
  name = "morning-summaries"
  schedule = "0 7 * * *"
  command = "cd backend && node scripts/generate-morning-summaries.js"
  timezone = "Africa/Libreville"

[[crons]]
  name = "afternoon-summaries"
  schedule = "0 13 * * *"
  command = "cd backend && node scripts/generate-afternoon-summaries.js"
  timezone = "Africa/Libreville"

[[crons]]
  name = "evening-summaries"
  schedule = "0 20 * * *"
  command = "cd backend && node scripts/generate-evening-summaries.js"
  timezone = "Africa/Libreville"
```

## 📊 Monitoring

### Visualiser les logs

```bash
# Logs des 7 derniers jours (par défaut)
node scripts/monitor-cron-jobs.js

# Logs des 30 derniers jours
node scripts/monitor-cron-jobs.js 30

# Logs d'aujourd'hui seulement
node scripts/monitor-cron-jobs.js 1
```

### Informations affichées

- ✅ **Statistiques globales:** Total, réussies, échouées, en cours
- 📋 **Par job:** Détails pour chaque créneau horaire
- 📅 **Par jour:** Vue d'ensemble quotidienne
- 🕐 **Dernières exécutions:** 10 plus récentes avec détails
- ⚠️  **Alertes:** Échecs dans les dernières 24h

### Exemple de sortie

```
📊 MONITORING CRON JOBS - 7 derniers jours
================================================================================
📅 Période: 10/10/2025 → 17/10/2025

📈 STATISTIQUES GLOBALES
--------------------------------------------------------------------------------
Total exécutions: 21
✅ Réussies:      18 (86%)
❌ Échouées:      2 (10%)
⏳ En cours:      1 (5%)

📋 PAR JOB
--------------------------------------------------------------------------------
🌅 morning-summaries         → Total: 7, ✅ 6, ❌ 1, ⏳ 0
☀️  afternoon-summaries      → Total: 7, ✅ 6, ❌ 1, ⏳ 0
🌙 evening-summaries         → Total: 7, ✅ 6, ❌ 0, ⏳ 1
```

## 🗄️ Base de Données

### Table `cron_logs`

Chaque exécution est loggée dans Supabase:

```sql
CREATE TABLE cron_logs (
  id UUID PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,        -- morning-summaries, etc.
  job_type VARCHAR(50) NOT NULL,         -- audio_generation
  time_slot VARCHAR(20),                 -- morning, afternoon, evening
  status VARCHAR(20) NOT NULL,           -- started, completed, failed
  triggered_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  error_message TEXT,
  metadata JSONB,                        -- IDs des résumés, langues, etc.
  created_at TIMESTAMP WITH TIME ZONE
);
```

### Requête manuelle

```sql
-- Voir les dernières exécutions
SELECT 
  job_name,
  time_slot,
  status,
  TO_CHAR(triggered_at AT TIME ZONE 'Africa/Libreville', 'DD/MM HH24:MI') as heure,
  duration_seconds,
  metadata->>'success_count' as langues_ok
FROM cron_logs
ORDER BY created_at DESC
LIMIT 20;
```

## 🛠️ Génération Manuelle

Si un résumé manque, vous pouvez le générer manuellement:

### Option 1: Via API

```bash
# Résumé français 13h
curl -X POST https://gabon24-7-production.up.railway.app/api/audio/generate-scheduled-summary \
  -H "Content-Type: application/json" \
  -d '{"timeSlot":"afternoon","language":"fr"}'

# Résumé anglais 20h
curl -X POST https://gabon24-7-production.up.railway.app/api/audio/generate-scheduled-summary \
  -H "Content-Type: application/json" \
  -d '{"timeSlot":"evening","language":"en"}'
```

### Option 2: Via Script

```bash
# Exécuter directement le script
cd backend
node scripts/generate-afternoon-summaries.js
```

### Option 3: Batch (tous les créneaux)

```bash
# Générer les 3 langues pour l'après-midi
for lang in fr en zh; do
  curl -X POST https://gabon24-7-production.up.railway.app/api/audio/generate-scheduled-summary \
    -H "Content-Type: application/json" \
    -d "{\"timeSlot\":\"afternoon\",\"language\":\"$lang\"}"
  sleep 3
done
```

## 🔍 Dépannage

### Vérifier si un cron job a échoué

```bash
node scripts/monitor-cron-jobs.js 1
```

Cherchez les ❌ dans la sortie et lisez les messages d'erreur.

### Logs Railway

1. Aller sur https://railway.app
2. Sélectionner le projet `gabon24-7`
3. Onglet **Deployments** → Cliquer sur le déploiement actif
4. Onglet **Logs** → Filtrer par:
   - `morning-summaries`
   - `afternoon-summaries`
   - `evening-summaries`

### Causes d'échec communes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Aucun article trouvé` | Pas d'articles dans les 24h | Synchroniser RSS feeds |
| `REPLICATE_API_TOKEN manquant` | Variable env absente | Ajouter dans Railway |
| `Timeout` | Génération trop longue | Augmenter timeout Railway |
| `Out of memory` | Pas assez de RAM | Upgrade plan Railway |

### Vérifier la santé du système

```bash
# Tester la connexion Supabase
curl https://gabon24-7-production.up.railway.app/api/health

# Voir les résumés disponibles
curl https://gabon24-7-production.up.railway.app/api/audio/public?limit=10
```

## 📈 Métriques à Suivre

- ✅ **Taux de réussite:** Doit être > 95%
- ⏱️  **Durée d'exécution:** Doit être < 600s (10 min)
- 📊 **Résumés par jour:** 9 (3 créneaux × 3 langues)
- 🎯 **Disponibilité:** Tous les créneaux doivent avoir résumés

## 🚨 Alertes

Le monitoring affiche automatiquement les alertes si:
- Échec dans les dernières 24h
- Résumé manquant pour un créneau
- Durée d'exécution anormale (> 10 min)

## 📞 Support

En cas de problème persistant:
1. Vérifier `INVESTIGATION_SCHEDULER.md`
2. Consulter les logs Railway
3. Exécuter le monitoring
4. Générer manuellement les résumés manquants

---

**Dernière mise à jour:** 17 octobre 2025  
**Version:** 1.0.0  
**Auteur:** Gabon Insight Team
