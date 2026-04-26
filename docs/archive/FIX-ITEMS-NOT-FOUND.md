# 🔧 Fix: "Item not found in step" Error

## 🐛 Problème
Vous voyez des erreurs dans la console :
```
Item step5_task3 not found in step 5
Item step5_task4 not found in step 5
Item step5_task2 not found in step 5
```

## 🎯 Cause
Ces erreurs surviennent parce que vous avez des **anciennes données** en base de données qui utilisent des IDs différents de ceux définis dans le nouveau système.

**Anciens IDs** (invalides) : `step5_task2`, `step5_task3`, `step5_task4`  
**Nouveaux IDs** (valides) : `lancement_evenement`, `lancement_kpis`, `lancement_tresorerie`

## ✅ Solution en 2 Étapes

### Étape 1 : Nettoyer les Anciennes Données (OBLIGATOIRE)

1. Ouvrez Supabase : https://app.supabase.com
2. SQL Editor → New Query
3. Copiez-collez le contenu de : `backend/migrations/cleanup_old_action_plan_items.sql`
4. Cliquez **Run** ▶️

Vous verrez :
```
Nombre d'items invalides trouvés: X
✅ Nettoyage terminé
Items restants: Y
Checklists actives: Z
✅ Progression recalculée pour toutes les checklists
```

### Étape 2 : Déployer le Code Corrigé

```bash
cd /Volumes/Samsung_T5/gabon24-7-main/frontend
npm run build
netlify deploy --prod
```

## 🧪 Vérification

Après le déploiement :

1. Rafraîchissez votre page (Ctrl+Shift+R ou Cmd+Shift+R)
2. Ouvrez la console (F12)
3. Naviguez vers **Mes Projets**
4. Les erreurs "Item not found" doivent avoir disparu ✅

## 📊 IDs Valides par Étape

### Étape 1 : Validation et Étude Préliminaire
- `validation_contacts`
- `validation_reglementation`
- `validation_budget`
- `validation_emplacement`
- `validation_concurrence`

### Étape 2 : Structuration Juridique
- `juridique_forme`
- `juridique_statuts`
- `juridique_anpi`
- `juridique_cnss`

### Étape 3 : Mise en Place Opérationnelle
- `operationnel_local`
- `operationnel_equipements`
- `operationnel_recrutement`

### Étape 4 : Stratégie Marketing
- `marketing_identite`
- `marketing_digital`
- `marketing_prospects`

### Étape 5 : Lancement et Suivi
- `lancement_evenement` ✅
- `lancement_kpis` ✅
- `lancement_tresorerie` ✅

## ⚠️ Impact du Nettoyage

**Ce qui sera supprimé** :
- Items avec des IDs invalides (ex: `step5_task2`, `step5_task3`, etc.)
- Données orphelines qui ne correspondent à aucune tâche définie

**Ce qui sera conservé** :
- Tous les items avec des IDs valides
- Toutes les réponses et documents associés
- Toutes les sous-tâches cochées (nouveau système)

## 🔄 Que Faire Après ?

Si vous aviez des **plans d'action personnalisés** avec des tâches différentes, vous devrez :

1. **Option A** : Régénérer les plans d'action avec le nouveau système
   - Avantage : IDs cohérents, pas d'erreurs
   - Inconvénient : Perte des anciennes réponses

2. **Option B** : Modifier `action-plan-checklist.ts` pour inclure vos anciens IDs
   - Avantage : Conservation des données
   - Inconvénient : Plus complexe

**Recommandation** : Option A (régénération) pour repartir sur une base saine.

## 🐛 Autres Erreurs Possibles

### "No checklist found for step X"
→ Normal si vous n'avez pas encore créé de plan d'action pour cette étape

### "Available items: []"
→ La checklist existe mais n'a pas d'items. Réexécutez la migration de nettoyage.

### Les sous-tâches ne se sauvegardent pas
→ Vérifiez que vous avez bien exécuté `add_subtasks_to_action_plan.sql`

## 📞 Besoin d'Aide ?

1. Vérifiez les logs Supabase (Dashboard → Logs)
2. Vérifiez la console navigateur (F12 → Console)
3. Vérifiez que les deux migrations ont été exécutées :
   - `add_subtasks_to_action_plan.sql` ✅
   - `cleanup_old_action_plan_items.sql` ✅

---

**Date** : 8 janvier 2025  
**Priorité** : 🔴 Haute (erreurs bloquantes)  
**Temps estimé** : 5 minutes
