# 🚂 Configuration Railway Cron Jobs

## ✅ Fichiers Créés

Tous les fichiers nécessaires ont été créés et poussés sur GitHub:

- ✅ `railway.toml` - Configuration Railway avec 3 cron jobs
- ✅ `backend/scripts/generate-morning-summaries.js` - Script 7h
- ✅ `backend/scripts/generate-afternoon-summaries.js` - Script 13h  
- ✅ `backend/scripts/generate-evening-summaries.js` - Script 20h
- ✅ `backend/scripts/monitor-cron-jobs.js` - Monitoring
- ✅ Table `cron_logs` créée dans Supabase

## 🎯 Activation dans Railway

### Option 1: Activation Automatique (Recommandé)

Railway détecte automatiquement `railway.toml` lors du prochain déploiement:

1. **Les fichiers sont déjà sur GitHub** ✅
2. **Railway va redéployer automatiquement**
3. **Les cron jobs seront créés automatiquement**

**Aucune action manuelle requise!** 🎉

### Option 2: Activation Manuelle (si nécessaire)

Si Railway ne détecte pas automatiquement:

1. **Aller sur Railway Dashboard:**
   ```
   https://railway.app
   ```

2. **Sélectionner le projet:**
   - Projet: `gabon24-7-production`
   - Service: Backend

3. **Onglet "Settings":**
   - Chercher "Cron Jobs" ou "Scheduled Tasks"
   - Railway devrait afficher les 3 cron jobs de `railway.toml`

4. **Vérifier les cron jobs:**
   ```
   🌅 morning-summaries (0 7 * * *)
   ☀️  afternoon-summaries (0 13 * * *)
   🌙 evening-summaries (0 20 * * *)
   ```

## 📊 Vérification

### 1. Logs Railway

Après le prochain déclenchement (7h, 13h ou 20h):

1. Dashboard Railway → `gabon24-7-production`
2. Onglet **"Deployments"**
3. Chercher **"Cron Executions"** ou logs séparés
4. Devrait voir les exécutions avec output complet

### 2. Base de Données

Vérifier les logs dans Supabase:

```sql
SELECT 
  job_name,
  time_slot,
  status,
  TO_CHAR(triggered_at AT TIME ZONE 'Africa/Libreville', 'DD/MM HH24:MI') as heure,
  duration_seconds,
  metadata->>'success_count' as langues_ok
FROM cron_logs
ORDER BY created_at DESC
LIMIT 10;
```

### 3. Script Monitoring

```bash
# Depuis votre machine locale
cd backend
node scripts/monitor-cron-jobs.js 1
```

Devrait afficher les exécutions des cron jobs.

### 4. API Résumés

```bash
curl -s "https://gabon24-7-production.up.railway.app/api/audio/public?limit=10" | jq
```

Vérifier que de nouveaux résumés apparaissent aux bons horaires.

## 🕐 Prochaines Exécutions

**Timezone: Africa/Libreville (WAT = UTC+1)**

| Heure Locale | UTC | Cron Job | Résumés Générés |
|--------------|-----|----------|-----------------|
| 07:00 WAT | 06:00 UTC | `morning-summaries` | 🇫🇷 FR, 🇺🇸 EN, 🇨🇳 ZH |
| 13:00 WAT | 12:00 UTC | `afternoon-summaries` | 🇫🇷 FR, 🇺🇸 EN, 🇨🇳 ZH |
| 20:00 WAT | 19:00 UTC | `evening-summaries` | 🇫🇷 FR, 🇺🇸 EN, 🇨🇳 ZH |

**Prochaine exécution:** 
- Si maintenant < 7h → 7h00 demain matin
- Si 7h < maintenant < 13h → 13h00 aujourd'hui
- Si 13h < maintenant < 20h → 20h00 aujourd'hui
- Si maintenant > 20h → 7h00 demain matin

## 🔍 Monitoring Continue

### Commande Monitoring

```bash
# Voir les logs d'aujourd'hui
node backend/scripts/monitor-cron-jobs.js 1

# Voir les logs des 7 derniers jours
node backend/scripts/monitor-cron-jobs.js 7

# Voir les logs du mois
node backend/scripts/monitor-cron-jobs.js 30
```

### Output Attendu

```
📊 MONITORING CRON JOBS - 7 derniers jours
================================================================================
📅 Période: 17/10/2025 → 24/10/2025

📈 STATISTIQUES GLOBALES
--------------------------------------------------------------------------------
Total exécutions: 21
✅ Réussies:      20 (95%)
❌ Échouées:      1 (5%)
⏳ En cours:      0 (0%)

📋 PAR JOB
--------------------------------------------------------------------------------
🌅 morning-summaries         → Total: 7, ✅ 7, ❌ 0, ⏳ 0
☀️  afternoon-summaries      → Total: 7, ✅ 6, ❌ 1, ⏳ 0
🌙 evening-summaries         → Total: 7, ✅ 7, ❌ 0, ⏳ 0
```

## 🚨 Alertes

Le script affiche automatiquement des alertes si:
- ❌ Échecs dans les dernières 24h
- ⏱️  Durée d'exécution > 10 minutes
- 📊 Moins de 3 langues générées

## 🛠️ Dépannage

### Si les cron jobs n'apparaissent pas

1. **Vérifier `railway.toml` est à la racine:**
   ```bash
   ls -la railway.toml
   ```

2. **Forcer un redéploiement:**
   - Dashboard Railway → Service → Settings
   - "Redeploy" button

3. **Vérifier les logs Railway:**
   - Chercher "railway.toml detected"
   - Chercher "cron jobs configured"

### Si un cron job échoue

1. **Logs Railway détaillés:**
   - Dashboard → Deployments → Cron execution logs
   - Voir l'erreur exacte

2. **Tester manuellement:**
   ```bash
   # SSH dans Railway (si disponible)
   cd backend && node scripts/generate-afternoon-summaries.js
   ```

3. **Vérifier variables d'environnement:**
   - `REPLICATE_API_TOKEN` présent?
   - `SUPABASE_URL` et `SUPABASE_KEY` corrects?

## 📞 Support

### Documentation Railway Cron

- https://docs.railway.app/reference/cron-jobs
- https://docs.railway.app/reference/config-as-code

### Logs et Debugging

```bash
# Monitoring local
node backend/scripts/monitor-cron-jobs.js

# Query Supabase directe
# (via dashboard Supabase → SQL Editor)

# Test génération manuelle
curl -X POST https://gabon24-7-production.up.railway.app/api/audio/generate-scheduled-summary \
  -H "Content-Type: application/json" \
  -d '{"timeSlot":"afternoon","language":"fr"}'
```

## ✅ Checklist de Vérification

- [ ] `railway.toml` présent à la racine
- [ ] Scripts exécutables dans `backend/scripts/`
- [ ] Table `cron_logs` créée dans Supabase
- [ ] Railway a redéployé après push
- [ ] Cron jobs visibles dans Railway Dashboard
- [ ] Premier cron job exécuté avec succès
- [ ] Logs visibles dans `cron_logs` table
- [ ] Monitoring script fonctionne
- [ ] Nouveaux résumés apparaissent dans API
- [ ] Lecteur audio affiche nouveaux résumés

---

**Date de création:** 17 octobre 2025  
**Statut:** ✅ Prêt pour activation  
**Action requise:** Attendre prochain déclenchement (7h, 13h ou 20h)
