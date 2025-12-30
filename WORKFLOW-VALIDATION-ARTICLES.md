# 📋 Workflow Validation Articles Sponsorisés

## 🎯 Objectif
Les articles sponsorisés créés avec génération IA ne sont **pas publiés automatiquement**. Ils passent par un système de validation admin avant d'apparaître dans le feed.

---

## 🔄 Workflow Complet

### **Étape 1 : Création Article (Client)**

**Page:** `/marketing/publicite/article-trending`

1. Client remplit le brief ou utilise génération IA
2. Article généré avec :
   - ✅ Titre, contenu, image
   - ⚠️ `is_published: false` (en attente)
   - ⚠️ `is_trending: false` (en attente)
   - ⚠️ `view_count: 0` (en attente)

3. Client paie en mode Demo
4. Article créé dans Supabase avec status **BROUILLON**

**Message utilisateur:**
```
✅ Article créé avec succès !
⏳ Votre article est en cours d'examen par notre équipe.
📧 Vous recevrez une notification dès validation (sous 24h).
```

---

### **Étape 2 : Modération Admin**

**Page:** `/admin/campaigns` → Onglet **"🔥 Articles Sponsorisés"**

#### **Vue Liste:**

```
┌─────────────────────────────────────────────┐
│ 📰 Articles Sponsorisés (3)                 │
├─────────────────────────────────────────────┤
│                                             │
│ [Image] TechGabon révolutionne...          │
│         📢 Gabon Insight • 19 oct 2025     │
│         ⏸ BROUILLON • 🔥 business          │
│         Contenu généré avec IA              │
│                                             │
│         [Publier] [Prévisualiser & Valider] [Supprimer]
│                                             │
└─────────────────────────────────────────────┘
```

**Badge statut:**
- 🟡 **BROUILLON** si `is_published: false`
- 🟢 **PUBLIÉ** si `is_published: true`

---

### **Étape 3 : Prévisualisation Article**

**Action:** Admin clique **"Prévisualiser & Valider"**

**Page:** `/admin/preview-article/[id]`

#### **Design:**
- Style **Gabon Insight** complet
- Header sticky avec actions admin
- Preview exact du rendu final

#### **Éléments affichés:**

```
┌─────────────────────────────────────────────────┐
│ ← Retour Admin     [⏸ EN ATTENTE]  [✓ Valider] [✗ Rejeter]
├─────────────────────────────────────────────────┤
│                                                 │
│           [IMAGE COUVERTURE 16:9]               │
│                                                 │
│ 📢 Gabon Insight • business • 🔥 Tendance       │
│ 👁️ 0 vues • 🔗 0 partages                      │
│                                                 │
│ # TechGabon révolutionne le e-commerce...      │
│                                                 │
│ 📄 Résumé:                                      │
│ Dans un contexte où l'économie numérique...    │
│                                                 │
│ Équipe Rédaction Gabon24-7 • 19 octobre 2025   │
│                                                 │
│ ─────────────────────────────────────────────  │
│                                                 │
│ ## Introduction contextuelle                    │
│ Le marché gabonais connaît une transformation...│
│                                                 │
│ ## Présentation de l'entreprise                 │
│ TechGabon, fondée en 2024 à Libreville...      │
│                                                 │
│ [... suite du contenu ...]                     │
│                                                 │
│ 📢 Contenu sponsorisé • Article publicitaire   │
└─────────────────────────────────────────────────┘
```

---

### **Étape 4A : Validation (Approuver)**

**Action:** Admin clique **"✓ Valider & Publier"**

#### **Modifications Supabase:**
```sql
UPDATE articles SET
  is_published = true,
  is_trending = true,
  published_at = NOW(),
  view_count = 5000 + random(3000),      -- Boost initial 5000-8000
  share_count = 50 + random(50),         -- 50-100 partages
  whatsapp_share_count = 30 + random(30) -- 30-60 WhatsApp
WHERE id = '[article_id]'
```

#### **Résultat:**
- ✅ Article publié **immédiatement**
- ✅ Apparaît dans **feed home** (page d'accueil)
- ✅ Apparaît dans **feed tendances** (`is_trending: true`)
- ✅ Badge **🟢 PUBLIÉ** dans admin
- ✅ Stats boostées pour visibilité

**Message admin:**
```
✅ Article validé et publié !
Il apparaît maintenant dans le feed home et tendances.
```

---

### **Étape 4B : Rejet (Refuser)**

**Action:** Admin clique **"✗ Rejeter"**

#### **Modifications Supabase:**
```sql
UPDATE articles SET
  is_published = false,
  is_trending = false
WHERE id = '[article_id]'
```

#### **Résultat:**
- ❌ Article **reste en brouillon**
- ❌ **N'apparaît pas** dans le feed
- ❌ Campagne reste **en attente**
- ⚠️ Client doit être notifié (TODO: email)

**Message admin:**
```
❌ Article rejeté.
La campagne reste en attente. Vous pouvez la supprimer ou demander des modifications.
```

---

## 📊 États de l'Article

| État | `is_published` | `is_trending` | `view_count` | Visible Feed | Visible Tendances |
|------|----------------|---------------|--------------|--------------|-------------------|
| **Brouillon** | `false` | `false` | `0` | ❌ Non | ❌ Non |
| **Publié** | `true` | `true` | `5000-8000` | ✅ Oui | ✅ Oui |
| **Dépublié** | `false` | `false` | conservé | ❌ Non | ❌ Non |

---

## 🎨 Interface Admin

### **Onglet Articles Sponsorisés:**

**Filtres automatiques:**
```typescript
supabase
  .from('articles')
  .select('*, feed:rss_feeds(name)')
  .like('external_id', 'sponsored-%') // Uniquement articles sponsorisés
  .order('created_at', { ascending: false })
```

**Actions disponibles:**

1. **Publier/Dépublier**
   - Toggle `is_published`
   - Bouton vert/jaune selon état

2. **Prévisualiser & Valider**
   - Ouvre `/admin/preview-article/[id]`
   - Preview style Gabon Insight
   - Boutons validation en header

3. **Supprimer**
   - Supprime article définitivement
   - Confirmation obligatoire

---

## 📱 Affichage Feed Public

### **Conditions d'affichage:**

```typescript
// Feed Home
supabase
  .from('articles')
  .select('*')
  .eq('is_published', true) // ✅ Obligatoire
  .order('published_at', { ascending: false })

// Feed Tendances
supabase
  .from('articles')
  .select('*')
  .eq('is_published', true) // ✅ Obligatoire
  .eq('is_trending', true)  // ✅ Obligatoire
  .order('view_count', { ascending: false })
```

**Articles sponsorisés validés:**
- ✅ Mélangés avec articles RSS normaux
- ✅ Badge **"📢 Publicité"** ou **"Sponsorisé"**
- ✅ Même style que articles éditoriaux
- ✅ Tracking vues/partages actif

---

## 🔔 Notifications (TODO)

### **À implémenter:**

**Validation approuvée:**
```
✅ Votre article sponsorisé a été validé !

"TechGabon révolutionne le e-commerce au Gabon"

Votre article est maintenant visible par plus de 50,000 lecteurs.

→ Voir l'article: https://gabon24-7.netlify.app/article/[id]
→ Dashboard stats: https://gabon24-7.netlify.app/dashboard
```

**Validation refusée:**
```
❌ Votre article sponsorisé nécessite des modifications

Raison: [Texte libre admin]

Suggestions:
- Vérifier conformité contenu
- Ajuster le ton éditorial
- Améliorer qualité rédactionnelle

→ Modifier: https://gabon24-7.netlify.app/edit-campaign/[id]
```

---

## 🛠️ Fichiers Modifiés

### **Backend:**
- Aucun changement (logique déjà présente)

### **Frontend:**

#### **1. `/checkout-campaigns/page.tsx`**
```typescript
// Ligne 254-258
is_trending: false,        // Admin doit valider
view_count: 0,             // Compteur démarre après validation
share_count: 0,
whatsapp_share_count: 0,
is_published: false        // ⚠️ Attente validation admin
```

#### **2. `/admin/preview-article/[id]/page.tsx`** *(Nouveau)*
- Page prévisualisation complète
- Style Gabon Insight
- Boutons validation (Approuver/Rejeter)
- Header sticky avec actions

#### **3. `/admin/campaigns/page.tsx`**
```typescript
// Ligne 1029-1033
<a href={`/admin/preview-article/${article.id}`}>
  {article.is_published ? 'Voir l\'article' : 'Prévisualiser & Valider'}
</a>
```

---

## ✅ Avantages Système

### **Pour Gabon24-7:**
- ✅ **Contrôle qualité** avant publication
- ✅ **Conformité éditoriale** garantie
- ✅ **Modération** contenu sponsorisé
- ✅ **Image de marque** préservée

### **Pour Client:**
- ✅ **Création facile** avec IA
- ✅ **Preview professionnel** avant publication
- ✅ **Boost visibilité** automatique après validation
- ✅ **Intégration native** dans feed

### **Pour Admin:**
- ✅ **Workflow clair** et rapide
- ✅ **Preview exact** du rendu final
- ✅ **Validation en 1 clic**
- ✅ **Gestion centralisée**

---

## 📖 Documentation Technique

### **Table Supabase: `articles`**

**Colonnes clés:**
```sql
id UUID PRIMARY KEY
external_id TEXT              -- 'sponsored-{campaign_id}'
title TEXT
summary TEXT
content TEXT
author TEXT
category TEXT
image_urls TEXT[]
published_at TIMESTAMP
view_count INTEGER DEFAULT 0
share_count INTEGER DEFAULT 0
whatsapp_share_count INTEGER DEFAULT 0
is_published BOOLEAN DEFAULT false  -- ⚠️ Validation requise
is_trending BOOLEAN DEFAULT false   -- ⚠️ Admin décide
feed_id UUID REFERENCES rss_feeds
```

### **Requêtes fréquentes:**

**Lister articles en attente:**
```sql
SELECT * FROM articles
WHERE external_id LIKE 'sponsored-%'
  AND is_published = false
ORDER BY created_at DESC;
```

**Valider article:**
```sql
UPDATE articles SET
  is_published = true,
  is_trending = true,
  published_at = NOW(),
  view_count = 5000 + floor(random() * 3000),
  share_count = 50 + floor(random() * 50),
  whatsapp_share_count = 30 + floor(random() * 30)
WHERE id = '[article_id]';
```

**Articles feed home:**
```sql
SELECT * FROM articles
WHERE is_published = true
ORDER BY published_at DESC
LIMIT 50;
```

**Articles tendances:**
```sql
SELECT * FROM articles
WHERE is_published = true
  AND is_trending = true
ORDER BY view_count DESC
LIMIT 20;
```

---

## 🚀 Déploiement

### **Netlify (Frontend):**
- ✅ Page preview automatiquement déployée
- ✅ Routes dynamiques `[id]` supportées
- ✅ Aucune config supplémentaire requise

### **Supabase:**
- ✅ Colonnes déjà présentes
- ✅ Politiques RLS actives
- ✅ Pas de migration nécessaire

---

## 📊 Métriques de Succès

**KPIs à suivre:**
- Temps moyen validation: < 4h
- Taux approbation: > 80%
- Articles publiés/jour: 5-10
- Engagement articles sponsorisés vs éditoriaux

---

## 🔜 Évolutions Futures

1. **Notifications email** validation/rejet
2. **Raisons de rejet** personnalisées
3. **Modification article** après rejet
4. **Historique validations** admin
5. **Analytics détaillés** par article
6. **A/B testing** titres/images
7. **Planification publication** (date/heure)

---

**Système validation professionnel prêt pour production ! 🎉**
