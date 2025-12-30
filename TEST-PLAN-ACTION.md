# 🧪 Test du Plan d'Action - Guide Complet

## ✅ Statut des Migrations

- ✅ Migration `add_subtasks_to_action_plan` exécutée
- ✅ Migration `cleanup_old_action_plan_items` exécutée
- ✅ Colonne `checked_subtasks` créée
- ✅ Trigger `auto_complete_task_on_subtasks` actif
- ✅ Code déployé sur Netlify

## 🔍 Erreurs Console à Ignorer

### 1. `runtime.lastError: The message port closed before a response was received`
**Type** : Avertissement Chrome Extension  
**Cause** : Extension navigateur (LaunchDarkly, AdBlock, etc.)  
**Impact** : Aucun sur l'application  
**Action** : ❌ Ignorer

### 2. `Failed to load resource: 500` sur UUID et stats
**Type** : Erreur temporaire  
**Cause** : Fonction Netlify en cold start ou timeout  
**Impact** : Minimal (retry automatique)  
**Action** : ⚠️ Surveiller si récurrent

### 3. `LaunchDarkly client initialized`
**Type** : Information  
**Cause** : Feature flags système  
**Impact** : Aucun  
**Action** : ✅ Normal

## 🧪 Tests à Effectuer

### Test 1 : Authentification ✅
```
1. Ouvrir https://gabon24-7.netlify.app
2. Se connecter
3. Vérifier dans la console :
   ✅ "🔐 Init Auth (persistance activée)..."
   ✅ "👤 Session Supabase valide (persistée)"
   ✅ "✅ Auth initialisé"
   ✅ "🔄 Auth change: INITIAL_SESSION"
```

### Test 2 : Chargement Mes Projets ✅
```
1. Cliquer sur "Business" → "Mes Projets"
2. Vérifier qu'aucune erreur "User not authenticated"
3. Les projets doivent s'afficher
```

### Test 3 : Génération Plan d'Action 🎯
```
1. Sélectionner un projet
2. Cliquer sur une étape (ex: Étape 1)
3. Cliquer sur "Générer avec IA" pour une tâche
4. Attendre la génération (10-30 secondes)
5. Vérifier dans la console :
   ✅ "✅ Plan d'action sauvegardé pour [item_id]"
   ❌ PAS d'erreur "User not authenticated"
```

### Test 4 : Persistance du Plan 🎯
```
1. Après génération du plan
2. Changer d'onglet (cliquer ailleurs dans l'app)
3. Revenir à l'étape
4. ✅ Le plan doit être toujours visible
5. Rafraîchir la page (F5)
6. ✅ Le plan doit être toujours visible
```

### Test 5 : Sous-tâches Cochées 🎯
```
1. Dans un plan généré
2. Cocher 2-3 sous-tâches
3. Vérifier dans la console :
   ✅ Requête UPDATE vers Supabase
4. Rafraîchir la page (F5)
5. ✅ Les sous-tâches restent cochées
```

### Test 6 : Auto-complétion Tâche Principale 🎯
```
1. Cocher toutes les sous-tâches d'une action
2. ✅ La tâche principale doit être barrée automatiquement
3. Décocher une sous-tâche
4. ✅ La tâche principale doit redevenir non barrée
```

### Test 7 : Progression de l'Étape 🎯
```
1. Compléter toutes les tâches d'une étape
2. ✅ Barre de progression = 100%
3. ✅ Étape marquée "complétée"
4. ✅ Badge vert sur l'étape
```

## 🐛 Problèmes Connus et Solutions

### Problème : "User not authenticated"
**Solution** : ✅ Corrigé dans commit `376f913`  
**Vérification** : Récupération directe via `supabase.auth.getUser()`

### Problème : Plan disparaît au changement d'onglet
**Solution** : ✅ Corrigé dans commit `6936b0e`  
**Vérification** : Retry automatique + logs de confirmation

### Problème : "Item not found in step 5"
**Solution** : ✅ Corrigé dans commit `605081e`  
**Vérification** : Nettoyage des IDs invalides via migration SQL

### Problème : Sous-tâches non persistées
**Solution** : ✅ Corrigé dans commit `8befc86`  
**Vérification** : Colonne `checked_subtasks` + trigger SQL

## 📊 Vérification Base de Données

### Requête 1 : Vérifier la colonne checked_subtasks
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'action_plan_checklist_items' 
  AND column_name = 'checked_subtasks';
```
**Résultat attendu** :
```
column_name: checked_subtasks
data_type: ARRAY
column_default: '{}'::integer[]
```

### Requête 2 : Vérifier le trigger
```sql
SELECT trigger_name, event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_auto_complete_task_on_subtasks';
```
**Résultat attendu** :
```
trigger_name: trigger_auto_complete_task_on_subtasks
event_manipulation: UPDATE
```

### Requête 3 : Vérifier les IDs valides
```sql
SELECT 
  apc.step_number,
  apci.item_id,
  COUNT(*) as count
FROM action_plan_checklist_items apci
JOIN action_plan_checklists apc ON apci.checklist_id = apc.id
GROUP BY apc.step_number, apci.item_id
ORDER BY apc.step_number, apci.item_id;
```
**Résultat attendu** : Tous les IDs doivent être valides (pas de `step5_task2`, etc.)

## 🎯 Checklist Finale

- [ ] Authentification fonctionne
- [ ] Mes Projets charge sans erreur
- [ ] Plan d'action se génère
- [ ] Plan persiste après changement d'onglet
- [ ] Plan persiste après refresh (F5)
- [ ] Sous-tâches se cochent
- [ ] Sous-tâches restent cochées après refresh
- [ ] Tâche principale se barre quand toutes sous-tâches cochées
- [ ] Progression de l'étape se met à jour
- [ ] Pas d'erreur "User not authenticated"
- [ ] Pas d'erreur "Item not found"

## 📞 Si Problème Persiste

1. **Vider le cache navigateur** :
   - Chrome : Ctrl+Shift+Delete → Cocher "Images et fichiers en cache"
   - Ou mode navigation privée

2. **Vérifier les logs Supabase** :
   - Dashboard Supabase → Logs
   - Chercher les erreurs récentes

3. **Vérifier les logs Netlify** :
   - https://app.netlify.com/projects/gabon24-7/logs/functions
   - Chercher les erreurs 500

4. **Console navigateur** :
   - F12 → Console
   - Copier toutes les erreurs rouges

---

**Dernière mise à jour** : 8 janvier 2025, 22:36 UTC+01:00  
**Version déployée** : Commit `376f913`  
**URL de test** : https://gabon24-7.netlify.app
