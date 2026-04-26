# Instructions pour la Migration des Sous-tâches du Plan d'Action

## 🎯 Objectif
Ajouter la persistance des sous-tâches cochées dans les plans d'action et implémenter le barrage automatique de la tâche principale quand toutes les sous-tâches sont complétées.

## 📋 Étapes d'Installation

### 1. Exécuter la Migration SQL dans Supabase

1. Connectez-vous à votre dashboard Supabase : https://app.supabase.com
2. Sélectionnez votre projet Gabon 24/7
3. Allez dans **SQL Editor** (menu de gauche)
4. Cliquez sur **New Query**
5. Copiez-collez le contenu du fichier `backend/migrations/add_subtasks_to_action_plan.sql`
6. Cliquez sur **Run** pour exécuter la migration

### 2. Vérifier que la Migration a Réussi

Exécutez cette requête dans le SQL Editor pour vérifier :

```sql
-- Vérifier que la colonne checked_subtasks existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'action_plan_checklist_items' 
  AND column_name = 'checked_subtasks';

-- Vérifier que le trigger existe
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_auto_complete_task_on_subtasks';
```

Vous devriez voir :
- Une ligne avec `checked_subtasks` de type `ARRAY`
- Une ligne avec le trigger `trigger_auto_complete_task_on_subtasks`

### 3. Déployer le Frontend

Le code frontend a déjà été modifié. Il vous suffit de :

```bash
cd /Volumes/Samsung_T5/gabon24-7-main/frontend
npm run build
```

Puis déployez sur Netlify :

```bash
netlify deploy --prod
```

## ✨ Nouvelles Fonctionnalités

### 1. Persistance des Sous-tâches Cochées
- Lorsque vous cochez une sous-tâche dans un plan d'action, elle est maintenant sauvegardée dans Supabase
- Les sous-tâches cochées restent cochées même après un rafraîchissement de la page
- Les données sont stockées dans la colonne `checked_subtasks` (array d'indices)

### 2. Barrage Automatique de la Tâche Principale
- Quand **toutes** les sous-tâches d'une action sont cochées, la tâche principale est automatiquement barrée (complétée)
- Si vous décochez une sous-tâche, la tâche principale redevient non complétée
- La progression de l'étape se met à jour automatiquement

### 3. Trigger SQL Automatique
- Un trigger PostgreSQL vérifie automatiquement si toutes les sous-tâches sont cochées
- Il marque automatiquement `is_completed = true` quand c'est le cas
- Cela garantit la cohérence des données même en cas de modification directe en base

## 🧪 Test de la Fonctionnalité

1. Allez dans **Mes Projets**
2. Sélectionnez un projet avec un plan d'action
3. Cliquez sur une étape pour voir les tâches
4. Générez un plan d'action avec l'IA pour une tâche
5. Cochez progressivement les sous-tâches
6. Observez la barre de progression qui se met à jour
7. Quand toutes les sous-tâches sont cochées, la tâche principale doit être automatiquement barrée ✅
8. Rafraîchissez la page (F5) - les sous-tâches cochées doivent rester cochées

## 🔧 Structure Technique

### Base de Données
- **Table** : `action_plan_checklist_items`
- **Nouvelle colonne** : `checked_subtasks INTEGER[]`
- **Trigger** : `trigger_auto_complete_task_on_subtasks`
- **Fonction** : `auto_complete_task_on_subtasks()`

### Frontend
- **Composant modifié** : `ActionPlanSteps.tsx`
- **Interface** : `ChecklistItemState` avec `checked_subtasks: number[]`
- **Fonction** : `checkAndAutoCompleteTask()` pour vérifier la complétion
- **Sauvegarde** : `saveItemToDatabase()` inclut maintenant `checked_subtasks`

## 📊 Exemple de Données

```json
{
  "item_id": "validation_contacts",
  "answer": "1. Contacter la Chambre de Commerce\n2. Appeler l'ANPME\n3. Rencontrer un mentor",
  "checked_subtasks": [0, 2],  // Sous-tâches 0 et 2 cochées
  "is_completed": false  // Pas toutes cochées donc tâche non complétée
}
```

Quand l'utilisateur coche la sous-tâche 1 :

```json
{
  "checked_subtasks": [0, 1, 2],  // Toutes cochées
  "is_completed": true,  // Automatiquement mis à true par le trigger
  "completed_at": "2025-01-08T10:30:00Z"
}
```

## ⚠️ Notes Importantes

1. **Nettoyage des anciennes données** : La migration nettoie automatiquement les anciennes données qui utilisaient `document_urls` pour stocker les sous-tâches (hack temporaire)

2. **Compatibilité** : Les anciens plans d'action sans sous-tâches continuent de fonctionner normalement

3. **Performance** : Un index GIN a été ajouté sur `checked_subtasks` pour optimiser les requêtes

## 🐛 Dépannage

### Les sous-tâches ne restent pas cochées
- Vérifiez que la migration SQL a bien été exécutée
- Vérifiez dans le Network tab que l'appel à `saveItemToDatabase` réussit (status 200)
- Vérifiez dans Supabase que la colonne `checked_subtasks` contient bien des données

### La tâche principale ne se barre pas automatiquement
- Vérifiez que le trigger `trigger_auto_complete_task_on_subtasks` existe
- Testez manuellement la fonction SQL :
```sql
SELECT auto_complete_task_on_subtasks();
```

### Erreur "column checked_subtasks does not exist"
- La migration n'a pas été exécutée correctement
- Réexécutez le fichier `add_subtasks_to_action_plan.sql`

## 📞 Support

En cas de problème, vérifiez :
1. Les logs Supabase (Dashboard → Logs)
2. La console du navigateur (F12)
3. Les logs Netlify Functions

---

**Date de création** : 8 janvier 2025  
**Version** : 1.0.0  
**Auteur** : Système Gabon 24/7
