# Test Création de Projet - Checklist

## ✅ Problème Résolu

**Erreur précédente:** `null value in column "article_title" violates not-null constraint`

**Solution appliquée:** Migration Supabase rendant les colonnes NULLABLE

**Status:** 🟢 Prêt pour test

---

## 🧪 Scénario de Test

### 1. Accéder au Formulaire
**URL:** https://gabon24-7.netlify.app/business/creer-projet

**Vérifications:**
- [ ] Page charge sans erreur
- [ ] Design moderne avec navigation circulaire
- [ ] 5 étapes visibles

---

### 2. Remplir Étape 1 - Idée & Vision

**Champs à remplir:**
- [ ] Idée de projet (ex: "Plateforme de livraison de repas à Libreville")
- [ ] Vision (ex: "Devenir le leader de la livraison au Gabon")
- [ ] Problème résolu (ex: "Difficulté à commander des repas de qualité")

**Action:** Cliquer "Suivant"

---

### 3. Remplir Étape 2 - Marché & Cible

**Champs à remplir:**
- [ ] Audience cible (ex: "Jeunes professionnels 25-40 ans")
- [ ] Taille du marché (select: "Petit", "Moyen", "Grand")
- [ ] Concurrents (ex: "Quelques restaurants avec livraison")
- [ ] Valeur unique (ex: "Livraison en 30 minutes garantie")

**Action:** Cliquer "Suivant"

---

### 4. Remplir Étape 3 - Business Model

**Champs à remplir:**
- [ ] Modèle de revenus (ex: "Commission sur chaque commande")
- [ ] Stratégie de prix (ex: "Frais de livraison 1500 FCFA")
- [ ] Structure de coûts (ex: "Livreurs, marketing, plateforme")
- [ ] Financement nécessaire (ex: "5,000,000 FCFA")

**Action:** Cliquer "Suivant"

---

### 5. Remplir Étape 4 - Ressources

**Champs à remplir:**
- [ ] Taille équipe (select: "Solo", "2-5", "6-10", "10+")
- [ ] Compétences clés (multi-select: "Marketing", "Tech", "Gestion", etc.)
- [ ] Timeline (select: "1-3 mois", "3-6 mois", "6-12 mois", "12+ mois")
- [ ] Localisation (ex: "Libreville, Gabon")

**Action:** Cliquer "Suivant"

---

### 6. Remplir Étape 5 - Objectifs

**Champs à remplir:**
- [ ] Objectifs court terme (ex: "Lancer MVP en 3 mois")
- [ ] Objectifs long terme (ex: "100 commandes/jour en 1 an")
- [ ] Métriques de succès (ex: "Taux de satisfaction > 90%")
- [ ] Risques (ex: "Concurrence, coûts logistiques")

**Action:** Cliquer "Générer mon Projet"

---

## 📊 Résultats Attendus

### Console Navigateur (F12)

**Logs attendus:**
```
🔐 Init Auth (persistance activée)...
👤 Session Supabase valide (persistée)
✅ Auth initialisé
🔄 Auth change: SIGNED_IN
[Requête POST] https://gabon24-7-production.up.railway.app/api/projects/generate-framework
✅ Projet créé avec succès!
```

**Erreurs à NE PAS voir:**
```
❌ 500 Internal Server Error
❌ null value in column "article_title"
❌ Could not find the 'budget' column
```

---

### Console Backend Railway

**Logs attendus:**
```
📝 Génération document cadre pour: user@email.com
🤖 Génération document cadre avec GPT-5 Nano...
✅ Document cadre généré: 3500 caractères
✅ Projet créé: [uuid]
📄 Document cadre sauvegardé: [uuid]
```

---

### Base de Données Supabase

**Vérifier dans table `saved_projects`:**

```sql
SELECT 
  id,
  user_id,
  title,
  description,
  category,
  budget,
  location,
  team_size,
  timeline,
  article_title,  -- Devrait être NULL
  created_at
FROM saved_projects
ORDER BY created_at DESC
LIMIT 1;
```

**Résultat attendu:**
- ✅ `title`: "Plateforme de livraison de repas à Libreville..."
- ✅ `description`: Résumé du document généré
- ✅ `category`: "restauration" ou "service"
- ✅ `budget`: "5000000" ou nombre extrait
- ✅ `location`: "Libreville, Gabon"
- ✅ `team_size`: "Solo" ou autre
- ✅ `timeline`: "3-6-mois" ou autre
- ✅ `article_title`: **NULL** (pas d'article source)
- ✅ `created_at`: Date/heure récente

**Vérifier dans table `project_documents`:**

```sql
SELECT 
  id,
  project_id,
  document_type,
  title,
  LENGTH(content) as content_length,
  metadata,
  created_at
FROM project_documents
ORDER BY created_at DESC
LIMIT 1;
```

**Résultat attendu:**
- ✅ `document_type`: "framework"
- ✅ `title`: "Document Cadre - [titre projet]"
- ✅ `content_length`: > 3000 caractères
- ✅ `metadata`: JSON avec `model: 'openai/gpt-5-nano'`

---

## 🎯 Critères de Succès

### ✅ Test Réussi Si:

1. **Formulaire:** Toutes les étapes remplissables sans erreur
2. **Génération:** Document cadre généré en 20-30 secondes
3. **Création:** Projet créé dans `saved_projects` avec `article_title = NULL`
4. **Document:** Document cadre sauvegardé dans `project_documents`
5. **Redirection:** User redirigé vers page de succès ou dashboard
6. **Pas d'erreur:** Aucune erreur 500 ou contrainte NOT NULL

### ❌ Test Échoué Si:

1. **Erreur 500:** Backend retourne erreur serveur
2. **Contrainte NOT NULL:** Erreur "null value in column"
3. **Timeout:** Génération prend > 2 minutes
4. **Pas de projet:** Rien créé dans Supabase
5. **Erreur frontend:** Console affiche erreurs

---

## 🔍 Debugging

### Si Erreur Persiste:

**1. Vérifier Backend Railway:**
```bash
# Logs Railway
https://railway.app/project/[project-id]/service/[service-id]/logs
```

**2. Vérifier Token Replicate:**
```bash
# Dans Railway Variables
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
```

**3. Vérifier Supabase:**
```sql
-- Colonnes NULLABLE?
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'saved_projects'
AND column_name IN ('article_title', 'problematique_centrale');
```

**4. Vider Cache:**
- Ctrl+Shift+R (hard refresh)
- Vider cache navigateur
- Tester en navigation privée

---

## 📝 Rapport de Test

**Date:** _______________  
**Testeur:** _______________  
**Navigateur:** _______________  

**Résultat Global:** ⬜ Réussi | ⬜ Échoué

**Notes:**
```
[Ajouter observations, erreurs, suggestions]
```

**Screenshots:**
- [ ] Formulaire rempli
- [ ] Console sans erreur
- [ ] Projet créé dans Supabase

---

**Dernière mise à jour:** 27 octobre 2025, 11:00 AM
