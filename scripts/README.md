# 🧪 Scripts de Test et Setup

## Scripts disponibles

### 1. `setup-slide-functions.js`
Crée les fonctions RPC Supabase pour le tracking des slides.

**Usage:**
```bash
node scripts/setup-slide-functions.js
```

**Prérequis:**
- `SUPABASE_URL` dans `.env`
- `SUPABASE_SERVICE_ROLE_KEY` dans `.env`

---

### 2. `test-slide-tracking.js` ✨
Teste automatiquement le système de tracking des slides.

**Usage:**
```bash
node scripts/test-slide-tracking.js
```

**Ce que le test vérifie:**
- ✅ Incrémentation des vues (`increment_slide_views`)
- ✅ Incrémentation des clics (`increment_slide_clicks`)
- ✅ Incrémentation des impressions (`increment_slide_impressions`)
- ✅ Récupération des stats (`get_slide_stats`)
- ✅ Enregistrement dans `slide_analytics`
- ✅ Calcul du CTR (Click-Through Rate)

**Sortie attendue:**
```
🧪 Test du système de tracking des slides

📋 Étape 1: Récupération d'un slide de test...
   ✅ Slide existant utilisé: abc-123-def
   📊 Stats initiales: { views: 10, clicks: 2, impressions: 15 }

📋 Étape 2: Test increment_slide_views...
   ✅ Vue incrémentée

📋 Étape 3: Test increment_slide_clicks...
   ✅ Clic incrémenté

📋 Étape 4: Test increment_slide_impressions...
   ✅ Impression incrémentée

📋 Étape 5: Vérification des stats avec get_slide_stats...
   📊 Stats après incrémentation:
      Views:       11 (attendu: 11)
      Clicks:      3 (attendu: 3)
      Impressions: 16 (attendu: 16)
      CTR:         27.27%

📋 Étape 6: Validation des résultats...
   Views:       ✅ OK
   Clicks:      ✅ OK
   Impressions: ✅ OK

📋 Étape 7: Vérification des événements dans slide_analytics...
   📊 3 événements récents enregistrés:
      - impression (16:32:45)
      - click (16:32:44)
      - view (16:32:43)

============================================================
✅ TOUS LES TESTS RÉUSSIS !
   Les fonctions RPC Supabase fonctionnent correctement.
============================================================
```

---

## Prérequis généraux

1. **Installer les dépendances:**
```bash
npm install
```

2. **Configurer `.env`:**
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

3. **Vérifier que les fonctions RPC existent dans Supabase:**
   - Aller sur Supabase Dashboard > SQL Editor
   - Exécuter: `SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE 'increment_slide%';`

---

## Dépannage

### Erreur: "Variables d'environnement manquantes"
- Vérifier que le fichier `.env` existe à la racine du projet
- Vérifier que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont définis

### Erreur: "function increment_slide_views does not exist"
- Exécuter d'abord `database/create_slide_analytics_functions.sql` dans Supabase
- Ou utiliser `node scripts/setup-slide-functions.js`

### Erreur: "relation 'slides' does not exist"
- Vérifier que la table `slides` existe dans Supabase
- Exécuter les migrations nécessaires

---

*Dernière mise à jour: 28 Décembre 2025*
