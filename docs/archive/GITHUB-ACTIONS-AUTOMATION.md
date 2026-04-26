# 🤖 SYSTÈME AUTOMATIQUE ET ROBUSTE

## ✅ SOLUTION MISE EN PLACE

GitHub Actions effectue **automatiquement** la synchronisation 3 fois par jour, sans intervention manuelle.

---

## 🔄 WORKFLOW GITHUB ACTIONS

### Fichier : `.github/workflows/sync-content.yml`

### Déclenchement Automatique (Cron)

```yaml
schedule:
  # 6h00 WAT (05h00 UTC) - Matin
  - cron: '0 5 * * *'
  
  # 13h00 WAT (12h00 UTC) - Après-midi
  - cron: '0 12 * * *'
  
  # 21h00 WAT (20h00 UTC) - Soir
  - cron: '0 20 * * *'
```

**3 exécutions quotidiennes :**
1. **06h00 WAT** : Synchronisation matinale
2. **13h00 WAT** : Synchronisation après-midi (après JT 13h)
3. **21h00 WAT** : Synchronisation soirée (après JT 20h)

---

## 🎯 TÂCHES AUTOMATISÉES

### 1. 📺 Extraction Journal TV
```bash
POST https://gabon24-7-production.up.railway.app/api/youtube/extract
```
- Extrait dernier journal depuis RSS YouTube
- Insert dans table `youtube_cache`
- Mise à jour `is_active = true`

### 2. 🇫🇷 Résumé Audio Français
```bash
POST https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary
Body: {"language":"fr"}
```
- Génère texte résumé (GPT-5 Nano)
- Génère audio (Kokoro TTS)
- Upload MP3 vers Supabase Storage
- Insert dans `audio_summaries`

### 3. 🇬🇧 Résumé Audio Anglais
```bash
POST https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary
Body: {"language":"en"}
```
- Même workflow en anglais
- Voix anglaise (Kokoro)

### 4. 🇨🇳 Résumé Audio Chinois
```bash
POST https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary
Body: {"language":"zh"}
```
- Même workflow en chinois
- Voix chinoise (Kokoro)

---

## 🛡️ ROBUSTESSE DU SYSTÈME

### Continue-on-error
```yaml
continue-on-error: true
```
**Si une étape échoue, les autres continuent.**

Exemple :
- Journal TV échoue → Résumés audio continuent
- Résumé FR échoue → EN et ZH continuent

### Timeouts
- **Journal TV :** 60 secondes max
- **Résumés audio :** 180 secondes max (3 minutes)

### Retry Automatique
GitHub Actions retry automatiquement en cas d'échec réseau.

### Logs Détaillés
Chaque étape affiche :
- ✅ Succès avec message
- ⚠️ Échec avec HTTP code + body
- 📊 Résumé final (réussis/échoués)

---

## 📊 RÉSUMÉ AUTOMATIQUE

À la fin de chaque exécution :

```
═══════════════════════════════════════════════════════════
📊 RÉSUMÉ DE LA SYNCHRONISATION
═══════════════════════════════════════════════════════════
   ✅ Réussis: 4
   ❌ Échoués: 0
═══════════════════════════════════════════════════════════

🔗 Vérifier sur:
   📺 Journal TV: https://gabon24-7.netlify.app/
   🔊 Résumés: https://gabon24-7.netlify.app/audio/daily
```

### États possibles :
1. **🎉 SUCCÈS COMPLET** : Les 4 tâches réussies
2. **⚠️ SUCCÈS PARTIEL** : Au moins 1 tâche réussie
3. **❌ ÉCHEC TOTAL** : Aucune tâche réussie (workflow fail)

---

## 🔍 SUIVI ET MONITORING

### Où voir les exécutions ?

**GitHub Repository :**
1. Aller sur https://github.com/FranckSowax/gabon24-7
2. Onglet **"Actions"**
3. Workflow **"🔄 Synchronisation Automatique du Contenu"**
4. Voir historique des exécutions

### Informations disponibles :
- ✅/❌ **Statut** de chaque exécution
- ⏱️ **Durée** d'exécution
- 📋 **Logs détaillés** par étape
- 📅 **Historique** complet (90 jours)

---

## 🚨 NOTIFICATIONS (OPTIONNEL)

### Configurer notifications échec

Ajouter à la fin du workflow :

```yaml
- name: Notification Échec
  if: failure()
  uses: actions/github-script@v6
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: '⚠️ Échec Synchronisation Automatique',
        body: 'La synchronisation du ' + new Date().toISOString() + ' a échoué.'
      })
```

Cela créera automatiquement une **GitHub Issue** en cas d'échec.

---

## 🎛️ DÉCLENCHEMENT MANUEL

### Via Interface GitHub

1. Aller sur **GitHub** → **Actions**
2. Workflow **"🔄 Synchronisation Automatique"**
3. Cliquer **"Run workflow"**
4. Bouton **"Run workflow"** (vert)
5. Attendre 2-3 minutes

### Via GitHub CLI

```bash
gh workflow run sync-content.yml
```

---

## 📈 AVANTAGES DU SYSTÈME

### ✅ Automatique
- **0 intervention manuelle** requise
- Fonctionne **24/7/365**
- **3 exécutions/jour** garanties

### ✅ Robuste
- **Continue malgré échecs** partiels
- **Retry automatique** réseau
- **Timeouts** pour éviter blocages
- **Logs détaillés** pour debug

### ✅ Gratuit
- **GitHub Actions gratuit** (2000 min/mois)
- **3 min/exécution × 3/jour × 30 jours = 270 min/mois**
- Largement dans la limite gratuite

### ✅ Fiable
- Infrastructure **GitHub** (99.9% uptime)
- **Pas de dépendance** Railway crons
- **Historique complet** des exécutions

### ✅ Scalable
- Ajouter nouvelles tâches facile
- Modifier horaires simple (edit `.yml`)
- Ajouter langues supplémentaires possible

---

## 🔧 CONFIGURATION

### Variables d'environnement (Railway)

Les endpoints API utilisent les variables configurées sur Railway :
- `REPLICATE_API_TOKEN` : Génération IA + Audio
- `SUPABASE_URL` : Base de données
- `SUPABASE_SERVICE_ROLE_KEY` : Permissions admin

**Aucune configuration GitHub nécessaire** - tout passe par Railway.

---

## 📝 MAINTENANCE

### Modifier les horaires

Éditer `.github/workflows/sync-content.yml` :

```yaml
schedule:
  # Exemple: Toutes les heures
  - cron: '0 * * * *'
  
  # Exemple: Toutes les 6 heures
  - cron: '0 */6 * * *'
  
  # Exemple: Minuit uniquement
  - cron: '0 0 * * *'
```

**Format Cron :** `minute heure jour mois jour_semaine`

### Ajouter une tâche

Ajouter un nouveau step dans le workflow :

```yaml
- name: 🆕 Nouvelle Tâche
  run: |
    curl -X POST "URL_API" \
      -H "Content-Type: application/json" \
      --max-time 60
```

### Désactiver temporairement

Commenter la section `schedule:` dans le `.yml` :

```yaml
# schedule:
#   - cron: '0 5 * * *'
```

---

## 🧪 TESTS

### Test local du workflow

Utiliser [act](https://github.com/nektos/act) :

```bash
# Installer act
brew install act

# Tester workflow
act schedule -W .github/workflows/sync-content.yml
```

### Test endpoints individuels

```bash
# Test extraction journal TV
curl -X POST "https://gabon24-7-production.up.railway.app/api/youtube/extract"

# Test résumé audio
curl -X POST "https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}'
```

---

## 📊 MÉTRIQUES

### Consommation GitHub Actions

**Par exécution :**
- Durée : ~2-3 minutes
- Coût : 0 (dans limite gratuite)

**Par mois :**
- Exécutions : 3/jour × 30 jours = 90
- Minutes : 90 × 3 = 270 min
- % limite : 270/2000 = **13.5%**

**Large marge restante** pour autres workflows.

---

## 🔗 RESSOURCES

- **GitHub Actions Docs :** https://docs.github.com/en/actions
- **Cron Syntax :** https://crontab.guru/
- **Repository Actions :** https://github.com/FranckSowax/gabon24-7/actions
- **Railway Dashboard :** https://railway.app/project/gabon24-7

---

## ✅ CHECKLIST DÉPLOIEMENT

- [x] Workflow `.github/workflows/sync-content.yml` créé
- [x] Endpoint `/api/youtube/extract` ajouté
- [x] Endpoint `/api/audio/generate-test-summary` existant
- [x] Variables Railway configurées
- [x] Commit et push sur `main`
- [x] Première exécution automatique programmée

---

## 🎉 RÉSULTAT FINAL

**Le système est maintenant 100% automatique et robuste :**

✅ **3 synchronisations/jour** sans intervention  
✅ **Journal TV toujours à jour** (6h, 13h, 21h)  
✅ **Résumés audio quotidiens** (FR, EN, ZH)  
✅ **Logs détaillés** pour monitoring  
✅ **Continue malgré échecs** partiels  
✅ **Gratuit** (GitHub Actions)  
✅ **Fiable** (infrastructure GitHub)  

**Plus besoin de lancer manuellement quoi que ce soit !** 🚀

---

**Dernière mise à jour :** 19 octobre 2025  
**Prochaine exécution :** Automatique demain 06h00 WAT
