# Système d'Abonnement Gabon 24/7

## Vue d'ensemble

Système complet d'abonnement multi-forfaits pour la plateforme d'agrégation de presse gabonaise Gabon 24/7. Comprend 3 forfaits (Gratuit, Découverte, Pro) avec authentification Supabase, paiements Mobile Money et interface moderne.

## Architecture

### Stack Technique
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Animations**: Framer Motion
- **Backend**: Supabase (Auth + Database + RLS)
- **Validation**: Zod + React Hook Form
- **Paiement**: Mobile Money (Airtel/Moov) - prêt pour intégration

### Structure des Fichiers

```
frontend/
├── src/
│   ├── app/
│   │   ├── abonnement/page.tsx          # Page pricing
│   │   ├── auth/
│   │   │   ├── signup/page.tsx          # Inscription
│   │   │   ├── signin/page.tsx          # Connexion
│   │   │   ├── confirm/page.tsx         # Confirmation email
│   │   │   └── callback/page.tsx        # Callback OAuth
│   │   └── dashboard/page.tsx           # Espace utilisateur
│   ├── lib/
│   │   ├── supabase.ts                  # Client Supabase
│   │   └── supabase-subscription.ts     # Helpers abonnements
│   ├── types/
│   │   ├── database.types.ts            # Types Supabase
│   │   └── subscription.types.ts        # Types métier
│   └── middleware.ts                    # Auth middleware
└── database/
    └── create_subscription_system.sql   # Schema complet
```

## Installation et Configuration

### 1. Prérequis
```bash
# Installer les dépendances
npm install @supabase/auth-helpers-nextjs @supabase/supabase-js
npm install framer-motion react-hook-form @hookform/resolvers zod
npm install lucide-react
```

### 2. Variables d'environnement
Créer `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Configuration Supabase

#### A. Exécuter le script SQL
```sql
-- Exécuter le fichier database/create_subscription_system.sql
-- dans l'éditeur SQL de Supabase
```

#### B. Configurer l'authentification
1. Aller dans Authentication > Settings
2. Activer "Enable email confirmations"
3. Configurer les redirections:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

#### C. Configurer OAuth Google (optionnel)
1. Aller dans Authentication > Providers
2. Activer Google OAuth
3. Ajouter Client ID et Client Secret

## Fonctionnalités

### 🎯 Forfaits Disponibles

#### Gratuit (0 XAF/mois)
- 15 articles par jour
- Titres et résumés illimités
- 1 source gouvernementale
- Newsletter hebdomadaire
- Recherche 7 derniers jours

#### Découverte (2 000 XAF/mois) - POPULAIRE
- Articles illimités
- Sans publicité
- Toutes sources gouvernementales
- Brief IA quotidien personnalisé
- Mode hors-ligne (50 articles)
- 10 alertes personnalisées
- Archives 6 mois
- Multi-plateforme

#### Pro (10 000 XAF/mois)
- Tout Découverte +
- Veille concurrentielle
- API Access
- 5 comptes équipe
- Revue de presse automatique
- Export illimité
- Archives complètes
- Support prioritaire 24/7
- Formations webinaires

### 🔐 Authentification
- Inscription par email + mot de passe
- OAuth Google
- Confirmation par email
- Réinitialisation mot de passe
- Sessions sécurisées

### 💳 Système de Paiement
- Mobile Money (Airtel Money, Moov Money)
- Essai gratuit 7 jours
- Facturation mensuelle/annuelle
- Historique des paiements
- Annulation à tout moment

### 📊 Dashboard Utilisateur
- Statut d'abonnement
- Utilisation des fonctionnalités
- Profil utilisateur
- Historique des paiements
- Actions rapides

## Utilisation

### Pages Principales

#### 1. Page Pricing (`/abonnement`)
```typescript
// Affiche les 3 forfaits avec comparaison
// Toggle mensuel/annuel
// Animations Framer Motion
// Redirection vers inscription
```

#### 2. Inscription (`/auth/signup`)
```typescript
// Formulaire avec validation Zod
// Sélection du forfait
// Création automatique du profil
// Essai gratuit 7 jours
```

#### 3. Dashboard (`/dashboard`)
```typescript
// Statut abonnement
// Statistiques d'utilisation
// Gestion du profil
// Actions rapides
```

### Helpers Supabase

```typescript
import { subscriptionHelpers } from '@/lib/supabase-subscription';

// Vérifier l'abonnement
const subscription = await subscriptionHelpers.getUserSubscription(userId);

// Vérifier l'accès à une fonctionnalité
const hasAccess = await subscriptionHelpers.checkFeatureAccess(userId, 'api_access');

// Tracker l'utilisation
await subscriptionHelpers.trackFeatureUsage(userId, 'article_read');
```

## Base de Données

### Tables Principales

#### `subscription_plans`
- Forfaits disponibles
- Prix mensuel/annuel
- Fonctionnalités et limitations
- Ordre d'affichage

#### `user_profiles`
- Profils utilisateurs étendus
- Informations personnelles
- Préférences

#### `subscriptions`
- Abonnements actifs
- Statuts et périodes
- Essais gratuits

#### `payment_history`
- Historique des paiements
- Références transactions
- Statuts de paiement

#### `feature_usage`
- Tracking d'utilisation
- Compteurs par fonctionnalité
- Limitations

### Fonctions SQL

#### `get_user_subscription_status(user_uuid)`
Retourne le statut complet de l'abonnement d'un utilisateur.

## Sécurité

### Row Level Security (RLS)
- Politiques par table
- Accès utilisateur limité
- Service role pour admin

### Middleware d'authentification
- Protection des routes
- Redirection automatique
- Gestion des sessions

## Intégration Paiement Mobile Money

### Structure prête pour:
```typescript
// Airtel Money
const airtelPayment = {
  amount: 2000,
  currency: 'XAF',
  phone: '+24177123456',
  reference: 'SUB_' + Date.now()
};

// Moov Money
const moovPayment = {
  amount: 2000,
  currency: 'XAF',
  phone: '+24166123456',
  reference: 'SUB_' + Date.now()
};
```

## Déploiement

### 1. Build de production
```bash
npm run build
```

### 2. Variables d'environnement production
```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Configuration Supabase production
- Mettre à jour les redirect URLs
- Configurer les webhooks de paiement
- Activer les politiques RLS

## Maintenance

### Monitoring
- Suivi des abonnements actifs
- Taux de conversion
- Utilisation des fonctionnalités
- Erreurs de paiement

### Mise à jour des forfaits
```sql
-- Modifier un forfait
UPDATE subscription_plans 
SET price_monthly = 2500, features = '["nouvelle_feature"]'::jsonb
WHERE slug = 'discovery';
```

## Support

### Logs et Debug
- Console navigateur pour erreurs frontend
- Logs Supabase pour erreurs backend
- Tracking des événements utilisateur

### Problèmes courants
1. **Email non confirmé**: Vérifier les paramètres SMTP
2. **Erreur OAuth**: Vérifier les URLs de redirection
3. **RLS bloquant**: Vérifier les politiques de sécurité

---

## 🚀 Prêt pour Production

Le système est entièrement fonctionnel et prêt pour:
- ✅ Inscription/connexion utilisateurs
- ✅ Gestion des abonnements
- ✅ Interface moderne et responsive
- ✅ Sécurité renforcée
- ⏳ Intégration paiement Mobile Money
- ⏳ Webhooks de notification

Pour toute question ou support technique, consultez la documentation Supabase ou contactez l'équipe de développement.
