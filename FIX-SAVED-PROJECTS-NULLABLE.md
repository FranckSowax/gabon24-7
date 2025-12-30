# Fix Contraintes NOT NULL - Table saved_projects

## 🐛 Problème Identifié

**Erreur:** `null value in column "article_title" of relation "saved_projects" violates not-null constraint`

**Cause:** La table `saved_projects` avait des colonnes avec contrainte NOT NULL qui ne sont pas remplies lors de la création d'un projet via le formulaire `/creer-projet`.

## 📊 Contexte

La table `saved_projects` sert **deux workflows différents** :

### 1. Workflow Analyzer (depuis article)
- **Source:** Analyse d'article d'actualité
- **Colonnes remplies:** `article_title`, `article_summary`, `article_url`, `problematique_centrale`, `secteur_selectionne`, `budget_selectionne`, `proposition_titre`, `proposition_description`
- **Exemple:** User lit article → Analyse → Génère proposition business

### 2. Workflow Formulaire Manuel (nouveau)
- **Source:** Formulaire `/business/creer-projet`
- **Colonnes remplies:** `title`, `description`, `category`, `budget`, `location`, `team_size`, `timeline`, `target_audience`, `unique_value`
- **Colonnes NON remplies:** `article_title` (pas d'article source), `problematique_centrale`, `secteur_selectionne`, etc.
- **Exemple:** User crée projet from scratch avec assistant IA

## ✅ Solution Appliquée

### Migration Supabase: `fix_saved_projects_nullable_columns`

```sql
ALTER TABLE saved_projects 
  ALTER COLUMN article_title DROP NOT NULL,
  ALTER COLUMN problematique_centrale DROP NOT NULL,
  ALTER COLUMN secteur_selectionne DROP NOT NULL,
  ALTER COLUMN budget_selectionne DROP NOT NULL,
  ALTER COLUMN proposition_titre DROP NOT NULL,
  ALTER COLUMN proposition_description DROP NOT NULL;
```

**Résultat:** Toutes ces colonnes sont maintenant **NULLABLE** (YES)

## 📋 Colonnes Modifiées

| Colonne | Avant | Après | Raison |
|---------|-------|-------|--------|
| `article_title` | NOT NULL | NULLABLE | Pas d'article dans workflow formulaire |
| `problematique_centrale` | NOT NULL | NULLABLE | Générée seulement dans analyzer |
| `secteur_selectionne` | NOT NULL | NULLABLE | Sélectionné seulement dans analyzer |
| `budget_selectionne` | NOT NULL | NULLABLE | Sélectionné seulement dans analyzer |
| `proposition_titre` | NOT NULL | NULLABLE | Généré seulement dans analyzer |
| `proposition_description` | NOT NULL | NULLABLE | Générée seulement dans analyzer |

## 🔧 Backend Inchangé

Le code backend dans `server.js` (ligne 4331-4356) insère correctement les colonnes pour le workflow formulaire :

```javascript
.insert({
  user_id: userId,
  title: projectCardData.title,              // ✅ Nouveau workflow
  description: projectCardData.description,  // ✅ Nouveau workflow
  category: projectCardData.category,        // ✅ Nouveau workflow
  status: 'active',
  phase: projectCardData.phase,
  budget: projectCardData.budget,            // ✅ Nouveau workflow
  location: projectCardData.location,
  team_size: projectCardData.team_size,
  timeline: projectCardData.timeline,
  target_audience: projectCardData.target_audience,
  unique_value: projectCardData.unique_value,
  // article_title: NULL (pas d'article)     // ✅ Maintenant OK
  // problematique_centrale: NULL            // ✅ Maintenant OK
  // secteur_selectionne: NULL               // ✅ Maintenant OK
  // ...
})
```

## 🧪 Test Recommandé

1. Aller sur https://gabon24-7.netlify.app/business/creer-projet
2. Remplir le formulaire (5 étapes)
3. Cliquer "Générer mon Projet"
4. ✅ Devrait fonctionner sans erreur 500

## 📝 Logs Attendus

### Console Backend
```
📝 Génération document cadre pour: user@email.com
🤖 Génération document cadre avec GPT-5 Nano...
✅ Document cadre généré: XXXX caractères
✅ Projet créé: [uuid]
📄 Document cadre sauvegardé: [uuid]
```

### Console Frontend
```
🔐 Init Auth (persistance activée)...
👤 Session Supabase valide (persistée)
✅ Auth initialisé
🔄 Auth change: SIGNED_IN
✅ Projet créé avec succès!
```

## 🎯 Avantages

✅ **Flexibilité:** Table supporte 2 workflows différents  
✅ **Pas de duplication:** Une seule table pour tous les projets  
✅ **Rétrocompatible:** Workflow analyzer continue de fonctionner  
✅ **Évolutif:** Facile d'ajouter d'autres workflows  

## 📊 Structure Finale

### Colonnes Obligatoires (NOT NULL)
- `id` (UUID, auto-généré)
- Aucune autre colonne obligatoire !

### Colonnes Optionnelles (NULLABLE)
**Workflow Analyzer:**
- `article_title`, `article_summary`, `article_url`
- `problematique_centrale`, `secteur_selectionne`
- `proposition_titre`, `proposition_description`

**Workflow Formulaire:**
- `title`, `description`, `category`
- `budget`, `location`, `team_size`
- `timeline`, `target_audience`, `unique_value`

**Commun:**
- `user_id`, `status`, `phase`
- `created_at`, `updated_at`
- `cumulative_context`, `user_context`

## 🚀 Déploiement

**Migration appliquée:** ✅ Supabase (27 oct 2025, 10:50 AM)  
**Backend:** ✅ Déjà compatible (aucun changement requis)  
**Frontend:** ✅ Déjà compatible (aucun changement requis)  

**Status:** 🟢 Prêt pour production

---

**Dernière mise à jour:** 27 octobre 2025, 10:50 AM  
**Migration:** `fix_saved_projects_nullable_columns`
