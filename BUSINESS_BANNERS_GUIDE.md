# 🚀 GUIDE DES TOP BARS BUSINESS DYNAMIQUES

## 📋 VUE D'ENSEMBLE

Système complet de bannières dynamiques pour **chaque fonction Business** de l'application, permettant de :
- ✅ Promouvoir les fonctionnalités premium
- ✅ Informer sur les coûts en crédits
- ✅ Rediriger vers les pages d'achat/abonnement
- ✅ Gérer les restrictions d'accès
- ✅ Suivre les performances (vues/clics)

---

## 🗄️ STRUCTURE BASE DE DONNÉES

### **Table : `business_banners`**

```sql
business_banners
├── id (UUID)
├── feature_slug (slug unique : 'mes-projets', 'actu-plus'...)
├── page_path (chemin page : '/business/mes-projets')
├── sort_order (ordre d'affichage)
├── is_active (activation on/off)
│
├── BADGE
│   ├── badge_text ("PREMIUM", "BUSINESS"...)
│   ├── badge_color (#F59E0B)
│   └── badge_icon (emoji : 📁, 📰, 🎧...)
│
├── CONTENU
│   ├── title ("Gérez vos Projets Business")
│   ├── subtitle ("Organisation & Suivi")
│   ├── description (texte descriptif)
│   └── features (array JSON : points clés)
│
├── CALL-TO-ACTION
│   ├── primary_cta_text ("Créer mon projet")
│   ├── primary_cta_url ("/business/mes-projets/new")
│   ├── primary_cta_type (action/credits/subscription)
│   ├── secondary_cta_text ("Voir la démo")
│   └── secondary_cta_url ("/demo")
│
├── DESIGN
│   ├── background_type (gradient/image/color)
│   ├── background_value (classe Tailwind ou hex)
│   ├── background_image (URL image)
│   └── text_color (#FFFFFF)
│
├── RESTRICTIONS
│   ├── require_subscription (boolean)
│   ├── required_subscription_plan ('premium', 'pro')
│   ├── require_credits (boolean)
│   └── credit_cost (nombre de crédits)
│
└── STATS
    ├── views_count (compteur affichages)
    ├── clicks_count (compteur clics CTA)
    ├── created_at
    └── updated_at
```

---

## 📦 FONCTIONS BUSINESS DISPONIBLES

### **1. Mes Projets** 📁
```typescript
feature_slug: 'mes-projets'
page_path: '/business/mes-projets'
require_subscription: true
required_subscription_plan: 'premium'
```

**Bannière** :
- Badge : "BUSINESS" (violet)
- Titre : "Gérez vos Projets Business"
- Points clés : Tableau de bord, Suivi étapes, Documents, Partage
- CTA : "Créer mon premier projet"

---

### **2. Actu++** 📰
```typescript
feature_slug: 'actu-plus'
page_path: '/actu-plus'
require_credits: true
credit_cost: 1
```

**Bannière** :
- Badge : "PREMIUM" (orange)
- Titre : "Actu++ : Analyses Approfondies"
- Points clés : Articles illimités, Analyses sectorielles, Rapports PDF
- CTA Principal : "Débloquer un article (1 crédit)"
- CTA Secondaire : "Acheter des crédits"

---

### **3. Résumés Audio** 🎧
```typescript
feature_slug: 'audio-summaries'
page_path: '/audio/daily'
require_credits: true
credit_cost: 5
```

**Bannière** :
- Badge : "IA AUDIO" (vert)
- Titre : "Résumés Audio Intelligents"
- Points clés : Résumés quotidiens, Voix naturelle, Multi-langues, MP3
- CTA Principal : "Générer un résumé (5 crédits)"
- CTA Secondaire : "S'abonner Premium"

---

### **4. Opportunités IA** 🤖
```typescript
feature_slug: 'ai-opportunities'
page_path: '/business/live-opportunities'
require_subscription: true
required_subscription_plan: 'pro'
require_credits: true
credit_cost: 15
```

**Bannière** :
- Badge : "IA PREMIUM" (violet)
- Titre : "Opportunités Business par IA"
- Points clés : Détection temps réel, Analyse marché, Scoring, Alertes
- CTA Principal : "Analyser une opportunité (15 crédits)"
- CTA Secondaire : "Passer à Pro"

---

### **5. Veille & Alertes** 🔔
```typescript
feature_slug: 'veille-alertes'
page_path: '/veille'
require_subscription: true
required_subscription_plan: 'premium'
require_credits: true
credit_cost: 3
```

**Bannière** :
- Badge : "VEILLE PRO" (rouge)
- Titre : "Veille Stratégique & Alertes"
- Points clés : Alertes SMS/Email, Mots-clés, Rapports, Dashboard
- CTA Principal : "Créer une alerte (3 crédits)"
- CTA Secondaire : "Découvrir Pro"

---

### **6. Publicité** 📢
```typescript
feature_slug: 'marketing-ads'
page_path: '/marketing/publicite'
require_subscription: false
require_credits: false
```

**Bannière** :
- Badge : "MARKETING" (bleu)
- Titre : "Publicité & Marketing Digital"
- Points clés : Bannières, Contenu sponsorisé, Ciblage, Analytics
- CTA : "Démarrer une campagne"

---

## 🎨 COMPOSANT REACT

### **Utilisation dans une page**

```typescript
import BusinessBanner from '@/components/business/BusinessBanner'

export default function MyPage() {
  return (
    <div>
      {/* Charge automatiquement la bannière pour cette page */}
      <BusinessBanner />
      
      {/* OU spécifier le feature_slug */}
      <BusinessBanner featureSlug="mes-projets" />
      
      {/* OU spécifier le chemin de page */}
      <BusinessBanner pagePath="/business/mes-projets" />
      
      {/* Votre contenu */}
      <div>...</div>
    </div>
  )
}
```

### **Fonctionnalités automatiques**

1. ✅ **Détection automatique** : Utilise le `pathname` actuel pour charger la bannière
2. ✅ **Vérification d'accès** : Vérifie l'abonnement et les crédits de l'utilisateur
3. ✅ **Badge "Verrouillé"** : Affiché si l'utilisateur n'a pas accès
4. ✅ **Tracking** : Enregistre les clics sur les CTA
5. ✅ **Responsive** : Adapté mobile/desktop

---

## 🛠️ INTERFACE ADMIN

### **Accès : `/admin/business-banners`**

#### **1. Créer une bannière**

```
[+ Nouvelle Bannière]
  ↓
Formulaire :
- Fonction Business (sélection)
- Badge (texte + couleur + icon)
- Titre + Sous-titre
- Description
- Points clés (multi-champs)
- CTA Principal (texte + URL + type)
- CTA Secondaire (optionnel)
- Background (gradient/image/color)
- Restrictions (abonnement + crédits)
```

#### **2. Modifier une bannière**

```
[✏️ Edit] → Formulaire pré-rempli → [💾 Mettre à jour]
```

#### **3. Activer/Désactiver**

```
[👁️] Actif → Visible sur le site
[👁️‍🗨️] Inactif → Caché temporairement
```

#### **4. Supprimer**

```
[🗑️ Delete] → Confirmation → Supprimé
```

---

## 🎨 OPTIONS DE PERSONNALISATION

### **1. Badge**

```typescript
badge_text: "PREMIUM" | "BUSINESS" | "IA" | "PRO" | ...
badge_color: Picker couleur (hex)
badge_icon: "📁" | "📰" | "🎧" | "🤖" | "🔔" | "📢"
```

### **2. Titre & Sous-titre**

```typescript
title: "Gérez vos Projets Business"
subtitle: "Organisation & Suivi"
```

### **3. Points clés (Features)**

```json
[
  "Tableau de bord projets",
  "Suivi des étapes",
  "Documents centralisés",
  "Partage d'équipe"
]
```

### **4. CTA Principal**

```typescript
primary_cta_text: "Créer mon projet"
primary_cta_url: "/business/mes-projets/new"
primary_cta_type: "action" | "credits" | "subscription"
```

**Types de CTA** :
- **action** : Action directe (icône →)
- **credits** : Coûte des crédits (icône ⚡)
- **subscription** : Nécessite abonnement (icône 👑)

### **5. Backgrounds**

#### **Gradient (défaut)**
```typescript
background_type: "gradient"
background_value: "from-orange-500 via-red-500 to-pink-600"
```

**Dégradés prédéfinis** :
- 🟧 Orange-Rouge
- 🟢 Vert-Cyan
- 🟣 Violet-Indigo
- 🔵 Bleu-Cyan
- 🔴 Rouge-Jaune
- 🟣 Violet Pro

#### **Image**
```typescript
background_type: "image"
background_image: "https://example.com/bg.jpg"
```

#### **Couleur unie**
```typescript
background_type: "color"
background_value: "#FF6B35"
```

### **6. Restrictions d'accès**

#### **Abonnement**
```typescript
require_subscription: true
required_subscription_plan: 'premium' | 'pro' | null
```

#### **Crédits**
```typescript
require_credits: true
credit_cost: 15 // Nombre de crédits requis
```

---

## 🔒 GESTION DES ACCÈS

### **Logique de vérification**

```typescript
function checkAccess(banner, user, subscriptionPlan) {
  // 1. Pas de restrictions → Accès libre
  if (!banner.require_subscription && !banner.require_credits) {
    return true
  }

  // 2. Utilisateur non connecté → Pas d'accès
  if (!user) {
    return false
  }

  // 3. Vérifier l'abonnement requis
  if (banner.require_subscription) {
    const planHierarchy = {
      'free': 0,
      'freemium': 0,
      'premium': 1,
      'pro': 2
    }

    const userLevel = planHierarchy[subscriptionPlan?.slug] || 0
    const requiredLevel = planHierarchy[banner.required_subscription_plan] || 1

    if (userLevel < requiredLevel) {
      return false // Abonnement insuffisant
    }
  }

  // 4. Pour les crédits, on retourne true
  //    (la vérification se fait au moment de l'action)
  return true
}
```

### **Affichage selon l'accès**

```typescript
{hasAccess ? (
  // Badge normal
  <span className="badge-premium">PREMIUM</span>
) : (
  // Badge verrouillé
  <span className="badge-locked">
    <Lock /> Verrouillé
  </span>
)}
```

---

## 📊 TRACKING & ANALYTICS

### **Compteurs automatiques**

```sql
-- Incrémentation automatique des vues (au chargement)
views_count += 1

-- Incrémentation au clic sur CTA
clicks_count += 1
```

### **Fonctions SQL**

```sql
-- Incrémenter les clics
SELECT increment_banner_clicks('banner-uuid');

-- Incrémenter les vues
SELECT increment_banner_views('banner-uuid');
```

### **Dashboard Analytics (futur)**

```
Top Bannières par Clics:
1. Opportunités IA : 1,234 clics
2. Résumés Audio : 987 clics
3. Mes Projets : 654 clics

Taux de Conversion:
- Veille & Alertes : 12.5% (123/987)
- Actu++ : 8.3% (82/987)
```

---

## 💻 EXEMPLES D'INTÉGRATION

### **Exemple 1 : Page Mes Projets**

```typescript
// app/business/mes-projets/page.tsx
import BusinessBanner from '@/components/business/BusinessBanner'

export default function MesProjetsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bannière automatique */}
      <BusinessBanner />
      
      {/* Contenu de la page */}
      <div className="container mx-auto px-4 py-8">
        <h1>Mes Projets</h1>
        {/* ... */}
      </div>
    </div>
  )
}
```

### **Exemple 2 : Page Actu++**

```typescript
// app/actu-plus/page.tsx
import BusinessBanner from '@/components/business/BusinessBanner'

export default function ActuPlusPage() {
  return (
    <div>
      {/* Bannière spécifique */}
      <BusinessBanner featureSlug="actu-plus" />
      
      {/* Articles premium */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {articles.map(article => (
          <PremiumArticleCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  )
}
```

### **Exemple 3 : Page Résumés Audio**

```typescript
// app/audio/daily/page.tsx
import BusinessBanner from '@/components/business/BusinessBanner'

export default function AudioSummariesPage() {
  return (
    <div>
      {/* Bannière avec path */}
      <BusinessBanner pagePath="/audio/daily" />
      
      {/* Liste des résumés */}
      <AudioSummaryList />
    </div>
  )
}
```

---

## 🚀 INSTALLATION

### **1. Exécuter les migrations SQL**

```bash
# Dans Supabase SQL Editor
# 1. Créer la table
# Exécuter: backend/migrations/create_business_banners_table.sql

# 2. Ajouter les fonctions de tracking
# Exécuter: backend/migrations/add_banner_click_tracking.sql
```

### **2. Vérifier les données initiales**

```sql
SELECT * FROM business_banners WHERE is_active = true;
-- Devrait retourner 6 bannières
```

### **3. Intégrer dans les pages**

```typescript
// Dans chaque page business
import BusinessBanner from '@/components/business/BusinessBanner'

// Ajouter en haut de page
<BusinessBanner />
```

---

## 📈 CAS D'USAGE

### **Cas 1 : Promouvoir nouvelle fonctionnalité**

```
Créer bannière:
- Feature: ai-opportunities
- Badge: NOUVEAU (bleu)
- Titre: Détection d'opportunités par IA
- CTA: Essayer gratuitement
- Restrictions: require_subscription = true
```

### **Cas 2 : Vendre des crédits**

```
Modifier bannière "Résumés Audio":
- CTA Principal: Générer résumé (5 crédits)
- CTA Secondaire: Acheter 100 crédits (remise 20%)
- Afficher coût en grand
```

### **Cas 3 : Upgrade vers Pro**

```
Bannière "Opportunités IA":
- Badge: VERROUILLÉ (si pas Pro)
- Message: Fonctionnalité réservée aux abonnés Pro
- CTA: Passer à Pro (2x plus d'opportunités)
```

---

## ✅ CHECKLIST DÉPLOIEMENT

- [x] Table `business_banners` créée
- [x] Fonctions SQL tracking créées
- [x] Composant `BusinessBanner.tsx` créé
- [x] Interface admin `/admin/business-banners` créée
- [x] 6 bannières initiales créées
- [x] RLS policies activées
- [ ] Intégrer dans pages business
- [ ] Tester accès selon abonnement
- [ ] Vérifier tracking clics/vues
- [ ] Créer dashboard analytics

---

## 🎯 RÉSUMÉ

**Le système de top bars business** offre :

1. ✅ **6 bannières** pour chaque fonction business
2. ✅ **Gestion admin complète** (CRUD)
3. ✅ **Vérification d'accès** (abonnement + crédits)
4. ✅ **Tracking performances** (vues/clics)
5. ✅ **Personnalisation totale** (badge, titre, CTA, design)
6. ✅ **Responsive** et moderne
7. ✅ **Badge "Verrouillé"** si pas d'accès
8. ✅ **Multi-CTA** (principal + secondaire)
9. ✅ **Points clés** (features list)
10. ✅ **3 types de CTA** (action, credits, subscription)

**Chaque fonction Business a maintenant sa propre bannière promotionnelle dynamique !** 🚀
