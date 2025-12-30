# 🚀 Guide Rapide : Activer la Persistance des Plans d'Action

## ⚡ En 3 Étapes Simples

### Étape 1️⃣ : Exécuter la Migration SQL (2 minutes)

1. Ouvrez Supabase : https://app.supabase.com
2. Sélectionnez votre projet **Gabon 24/7**
3. Menu gauche → **SQL Editor**
4. Cliquez **New Query**
5. Copiez-collez le contenu de : `backend/migrations/add_subtasks_to_action_plan.sql`
6. Cliquez **Run** ▶️

✅ Vous devriez voir : `Migration terminée: colonne checked_subtasks ajoutée avec trigger auto-completion`

### Étape 2️⃣ : Déployer le Frontend (5 minutes)

```bash
cd /Volumes/Samsung_T5/gabon24-7-main/frontend
npm run build
netlify deploy --prod
```

✅ Attendez que le déploiement soit terminé (environ 3-5 minutes)

### Étape 3️⃣ : Tester ! (1 minute)

1. Allez sur votre site : https://gabon24-7.netlify.app
2. Connectez-vous
3. Menu **Business** → **Mes Projets**
4. Ouvrez un projet avec un plan d'action
5. Générez un plan d'action pour une tâche (bouton violet "Générer avec IA")
6. Cochez quelques sous-tâches
7. **Rafraîchissez la page (F5)**
8. ✨ Les sous-tâches doivent rester cochées !
9. Cochez toutes les sous-tâches → la tâche principale doit être barrée automatiquement ✅

## 🎯 Ce Qui Change Pour Vous

### Avant ❌
- Les sous-tâches cochées disparaissaient au rafraîchissement
- Impossible de suivre votre progression réelle
- Tâche principale jamais complétée automatiquement

### Après ✅
- **Persistance totale** : Vos sous-tâches cochées sont sauvegardées
- **Progression réelle** : Vous pouvez suivre votre avancement jour après jour
- **Auto-complétion** : La tâche principale se barre quand tout est fait
- **Synchronisation** : Fonctionne sur tous vos appareils

## 🔍 Vérification Rapide

### Test 1 : Persistance
```
1. Cochez 3 sous-tâches
2. Rafraîchissez (F5)
3. ✅ Les 3 sous-tâches doivent rester cochées
```

### Test 2 : Auto-complétion
```
1. Cochez toutes les sous-tâches d'une action
2. ✅ La tâche principale doit être barrée automatiquement
3. Décochez une sous-tâche
4. ✅ La tâche principale doit redevenir non barrée
```

### Test 3 : Progression
```
1. Complétez toutes les tâches d'une étape
2. ✅ La barre de progression doit afficher 100%
3. ✅ L'étape doit être marquée comme "complétée"
```

## 🐛 Problème ?

### Les sous-tâches ne restent pas cochées
→ Vérifiez que vous avez bien exécuté la migration SQL (Étape 1)

### La tâche ne se barre pas automatiquement
→ Vérifiez dans Supabase SQL Editor :
```sql
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_auto_complete_task_on_subtasks';
```
Vous devez voir une ligne. Si non, réexécutez la migration.

### Erreur au déploiement
→ Assurez-vous d'être dans le bon dossier :
```bash
pwd
# Doit afficher : /Volumes/Samsung_T5/gabon24-7-main/frontend
```

## 📞 Besoin d'Aide ?

Consultez le guide complet : `INSTRUCTIONS-MIGRATION-SUBTASKS.md`

---

**Temps total estimé** : 8 minutes  
**Difficulté** : ⭐ Facile  
**Impact** : 🚀 Majeur sur l'expérience utilisateur
