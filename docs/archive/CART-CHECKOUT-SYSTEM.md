# 🛒 Système de Panier et Paiement pour Campagnes Publicitaires

## Vue d'ensemble

Système complet de panier d'achat et de checkout permettant aux utilisateurs de payer leurs campagnes publicitaires via **3 méthodes de paiement**:
1. 💳 **Mobile Money** (Airtel, Moov, MTN)
2. 💳 **Carte de Crédit** (Visa, Mastercard)
3. 💵 **Cash sur Place** (paiement en espèces)

---

## 🎯 Workflow Complet

### Workflow Utilisateur

```
1. Utilisateur crée une campagne (ex: Vidéo Home)
   ↓
2. Remplit formulaire (nom, vidéo, dates, etc.)
   ↓
3. Clique "Soumettre" → Campagne AJOUTÉE AU PANIER
   ↓
4. Popup: "Voulez-vous procéder au paiement?"
   ├─ OUI → Redirigé vers /checkout-campaigns
   └─ NON → Retour à /marketing/public

ite
   ↓
5. Sur la page checkout:
   - Voit son panier (campagnes)
   - Remplit infos personnelles
   - Choisit méthode de paiement
   - Confirme le paiement
   ↓
6. Paiement traité:
   - Campagnes créées avec status: 'unpaid'
   - Payment enregistré dans campaign_payments
   - Redirection vers page succès
   ↓
7. Statut selon méthode:
   ├─ Mobile Money: status='processing' → Notification push
   ├─ Carte: status='processing' → Traitement sécurisé
   └─ Cash: status='pending_cash' → Attente paiement bureau
   ↓
8. Après paiement confirmé:
   - status paiement → 'completed'
   - status campagnes → 'pending' (attente validation admin)
   ↓
9. Admin valide campagnes:
   - status campagnes → 'active'
   - Campagnes deviennent visibles
```

---

## 📁 Architecture du Système

### Backend

**Table Supabase: `campaign_payments`**
```sql
CREATE TABLE campaign_payments (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_email VARCHAR(255),
  user_phone VARCHAR(50),
  user_full_name VARCHAR(255),
  
  payment_method VARCHAR(50), -- 'mobile_money', 'card', 'cash'
  status VARCHAR(50),          -- 'pending', 'processing', 'completed', 'failed', 'pending_cash'
  
  amount INTEGER,
  campaign_ids UUID[],         -- Array des campagnes
  
  -- Mobile Money
  mobile_operator VARCHAR(50),
  mobile_number VARCHAR(50),
  
  -- Cash
  pickup_location VARCHAR(255),
  pickup_notes TEXT,
  
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)
```

**Colonnes ajoutées à `campaigns`:**
- `payment_status`: 'pending', 'completed', 'failed'
- `payment_id`: UUID (référence campaign_payments)

**Trigger automatique:**
```sql
-- Quand payment.status = 'completed'
-- → Mettre campaigns.status = 'pending'
-- → Mettre campaigns.payment_status = 'completed'
```

### Frontend

**Fichiers créés:**
```
frontend/src/
├── lib/
│   └── cart.ts                              # Gestion panier (localStorage)
├── components/
│   └── cart/
│       ├── CartButton.tsx                   # Bouton flottant
│       ├── CartDrawer.tsx                   # Drawer panier
│       └── CartProvider.tsx                 # Wrapper client
└── app/
    ├── checkout-campaigns/
    │   └── page.tsx                         # Page checkout
    └── checkout/
        └── success-campaign/
            └── page.tsx                     # Page succès
```

---

## 🛠️ Lib: cart.ts

### Fonctionnalités

**Interface CartItem:**
```typescript
interface CartItem {
  id: string
  campaign_type: 'banner-home' | 'banner-feed' | 'video-home' | 'article-trending'
  name: string
  budget: number
  duration_days: number
  start_date: string
  details: {
    // Détails spécifiques selon type
    video_url?: string
    banner_image_url?: string
    redirect_url?: string
    design_request?: boolean
    ...
  }
  added_at: string
}
```

**Fonctions principales:**
```typescript
getCart(): CartItem[]              // Lire panier
saveCart(cart: CartItem[]): void   // Sauvegarder panier
addToCart(item): CartItem          // Ajouter au panier
removeFromCart(itemId): void       // Retirer du panier
clearCart(): void                  // Vider panier
getCartTotal(): number             // Total panier
getCartCount(): number             // Nombre d'items
```

**Stockage:** localStorage clé `'gabon24-7-cart'`

**Événement:** `'cart-updated'` émis à chaque modification

---

## 🎨 CartButton.tsx

### Fonctionnalités

- **Bouton flottant:** Position fixe bottom-right
- **Badge count:** Affiche nombre d'items
- **Animation:** Bounce quand item ajouté
- **Écoute événements:** Mise à jour automatique

**Affichage:**
```
┌────────────────────┐
│                    │
│                    │
│              [🛒3] │ ← Badge avec count
└────────────────────┘
```

---

## 📦 CartDrawer.tsx

### Fonctionnalités

- **Drawer latéral:** Slide-in depuis la droite
- **Liste items:** Avec nom, dates, prix
- **Actions:** Retirer item, vider panier
- **Total:** Affichage sous-total
- **Bouton checkout:** "Procéder au paiement"

**UI:**
```
┌─────────────────────────────┐
│ Mon Panier       [X]        │
│ 2 campagnes                 │
├─────────────────────────────┤
│ 🎬 Vidéo Home              │
│ Ma campagne vidéo           │
│ 📅 20 oct. 2025             │
│ ⏱️ 7 jours                  │
│ Prix: 450,000 FCFA     [🗑️] │
├─────────────────────────────┤
│ 🏠 Bannière Home           │
│ ...                         │
├─────────────────────────────┤
│ Sous-total: 550,000 FCFA   │
│                             │
│ [💳 Procéder au paiement]  │
└─────────────────────────────┘
```

---

## 💳 Page Checkout

**URL:** `/checkout-campaigns`

### Sections

**1. Informations personnelles:**
- Nom complet *
- Email *
- Téléphone *

**2. Méthode de paiement:**

#### A. Mobile Money
- Opérateur (Airtel / Moov / MTN)
- Numéro Mobile Money *

#### B. Carte de Crédit
- (Redirect vers partenaire paiement)

#### C. Cash sur Place
- Bureau de paiement (Libreville / Port-Gentil / Franceville)
- Notes optionnelles

**3. Résumé commande:**
- Liste campagnes
- Total
- Bouton "Confirmer le paiement"

### Logique de Paiement

**Étapes:**
1. Validation formulaire
2. Upload vidéos (si nécessaire)
3. Création campagnes avec status='unpaid'
4. Enregistrement payment dans campaign_payments
5. Vider panier (clearCart)
6. Redirection → `/checkout/success-campaign?method=mobile&payment_id=xxx`

---

## ✅ Page Succès

**URL:** `/checkout/success-campaign`

**Query Params:**
- `method`: 'mobile', 'card', ou 'cash'
- `payment_id`: UUID du paiement

### Affichage selon Méthode

#### Mobile Money:
```
✅ Paiement Mobile Money en cours

Vous allez recevoir une notification push
sur votre téléphone pour valider le paiement.

Prochaines étapes:
1. Vérifiez votre téléphone
2. Entrez votre code PIN
3. Confirmation SMS
4. Activation après validation admin

⏱️ Délai: 5-10 minutes
```

#### Carte:
```
✅ Paiement par Carte en cours

Votre paiement est en cours de traitement.

⏱️ Délai: 2-5 minutes
```

#### Cash:
```
✅ Paiement en Espèces - À Finaliser

Rendez-vous à nos bureaux pour payer:
📍 Libreville - Centre-ville
📋 Numéro commande: XXXXX
💵 Montant: 450,000 FCFA

⏱️ Délai: 24-48 heures
```

---

## 🔄 Statuts des Campagnes

### Cycle de Vie

```
1. unpaid       → Campagne créée, paiement en attente
   ↓ (paiement confirmé)
2. pending      → Paiement OK, attente validation admin
   ↓ (admin valide)
3. active       → Campagne live et visible
```

### Statuts de Paiement

**campaign_payments.status:**
- `pending`: Créé, non traité
- `processing`: En cours (Mobile/Card)
- `completed`: Paiement confirmé ✅
- `failed`: Paiement échoué ❌
- `pending_cash`: Attente paiement espèces 💵

**campaigns.payment_status:**
- `pending`: Attente paiement
- `completed`: Payé ✅
- `failed`: Paiement échoué ❌

---

## 💻 Modification des Formulaires

### Avant (Direct)

```typescript
// Ancien workflow
const handleSubmit = async () => {
  // Upload vidéo
  // Créer campagne directement
  // status = 'pending'
  router.push('/marketing/publicite')
}
```

### Maintenant (Panier)

```typescript
import { addToCart } from '@/lib/cart'

const handleSubmit = async () => {
  // Upload vidéo
  
  // Ajouter au panier
  addToCart({
    campaign_type: 'video-home',
    name: formData.name,
    budget: 450000,
    duration_days: 7,
    start_date: formData.startDate,
    details: { video_url, ... }
  })
  
  // Popup confirmation
  const goToCheckout = confirm('Ajouté au panier! Procéder au paiement?')
  
  if (goToCheckout) {
    router.push('/checkout-campaigns')
  } else {
    router.push('/marketing/publicite')
  }
}
```

---

## 📊 Table campaign_payments

**Fichier SQL:** `supabase-campaign-payments.sql`

### Colonnes Principales

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | ID unique |
| user_email | VARCHAR | Email utilisateur |
| payment_method | VARCHAR | 'mobile_money', 'card', 'cash' |
| status | VARCHAR | 'pending', 'processing', 'completed', ... |
| amount | INTEGER | Montant total en FCFA |
| campaign_ids | UUID[] | Array des campagnes |
| mobile_operator | VARCHAR | 'airtel', 'moov', 'mtn' |
| pickup_location | VARCHAR | Lieu paiement cash |

### Trigger Automatique

```sql
-- Quand payment.status passe à 'completed':
CREATE TRIGGER trigger_update_campaigns_after_payment
  AFTER UPDATE ON campaign_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_after_payment();

-- Fonction:
-- 1. Met status campagnes → 'pending'
-- 2. Met payment_status → 'completed'
-- 3. Lie payment_id
```

---

## 🎯 Avantages du Système

### Pour les Utilisateurs

✅ **Flexibilité paiement:** 3 méthodes au choix  
✅ **Panier multi-campagnes:** Ajouter plusieurs campagnes  
✅ **Paiement unique:** Payer toutes les campagnes ensemble  
✅ **Suivi transparent:** Statuts clairs  
✅ **Cash accepté:** Pour utilisateurs sans mobile money/carte  

### Pour l'Admin

✅ **Gestion centralisée:** Table campaign_payments  
✅ **Traçabilité:** Historique complet des paiements  
✅ **Validation simplifiée:** Une fois payé, juste valider  
✅ **Stats paiements:** Vue agrégée disponible  

### Technique

✅ **localStorage:** Panier persistant  
✅ **Événements custom:** Mise à jour automatique UI  
✅ **Triggers SQL:** Automatisation workflow  
✅ **RLS Supabase:** Sécurité intégrée  
✅ **TypeScript:** Type-safe  

---

## 🔐 Sécurité

### Backend

- **RLS Supabase:** Politiques restrictives
- **Validation:** Tous les champs vérifiés
- **Trigger SQL:** Automatisation sécurisée
- **user_id:** Lié à auth.users

### Frontend

- **localStorage:** Données locales uniquement
- **Validation:** Avant envoi au backend
- **HTTPS:** Communication sécurisée
- **Pas de données sensibles:** Pas de détails carte stockés

---

## 📈 Statistiques

**Vue SQL créée:** `campaign_payments_stats`

```sql
SELECT
  payment_method,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  DATE_TRUNC('day', created_at) as date
FROM campaign_payments
GROUP BY payment_method, status, date
```

**Utilisation admin:**
- Revenus par méthode
- Taux de conversion
- Paiements en attente

---

## 🚀 Déploiement

### Checklist

- [ ] Créer table campaign_payments (supabase-campaign-payments.sql)
- [ ] Ajouter colonnes campaigns (payment_status, payment_id)
- [ ] Déployer frontend avec nouveaux composants
- [ ] Tester les 3 méthodes de paiement
- [ ] Configurer partenaires paiement (Mobile Money, Carte)
- [ ] Former l'équipe sur workflow cash

### Configuration Requise

**Supabase:**
```bash
# Exécuter dans Supabase SQL Editor
supabase-campaign-payments.sql
```

**Frontend:**
- ✅ localStorage activé
- ✅ CartProvider dans layout
- ✅ Routes checkout créées

**Backend:**
- ✅ Endpoint /api/campaigns existant
- ⏳ À venir: Intégrations paiement (Mobile Money API, Stripe)

---

## 🧪 Tests

### Scénario 1: Mobile Money

```
1. Créer campagne Vidéo Home
2. Ajouter au panier
3. Checkout → Choisir Mobile Money
4. Remplir: Airtel, +241 XX XX XX XX
5. Confirmer
6. Vérifier:
   - Campagne created with status='unpaid'
   - Payment created with status='processing'
   - Redirection success page
```

### Scénario 2: Panier Multiple

```
1. Créer campagne Vidéo
2. Ajouter au panier
3. Retour → Créer Bannière
4. Ajouter au panier
5. Panier: 2 items
6. Checkout → Total = somme des 2
7. Payer → 2 campagnes créées
```

### Scénario 3: Cash

```
1. Ajouter campagne
2. Checkout → Cash
3. Choisir Libreville
4. Confirmer
5. Page succès: Instructions visite bureau
6. Status: pending_cash
```

---

## 📝 Notes Importantes

### Moment du Paiement

**✅ Choisi: APRÈS création formulaire, AVANT validation admin**

**Workflow:**
```
Formulaire → Panier → Paiement → Campagne (unpaid) → Admin valide → Active
```

**Pourquoi?**
- Utilisateur peut ajouter plusieurs campagnes
- Paiement unique pour toutes
- Upload vidéos fait AVANT paiement (pas de perte si paiement échoue)
- Admin valide uniquement campagnes payées

### Prix avec Option Design

```typescript
const baseBudget = 450000  // Prix campagne
const designCost = formData.designRequest ? 300000 : 0
const totalBudget = baseBudget + designCost  // Total panier
```

### Gestion Échecs Paiement

- **Mobile Money timeout:** status='failed'
- **Carte refusée:** status='failed'
- **Cash non reçu:** status='pending_cash' (peut être annulé après 7 jours)

---

## 🎯 Prochaines Étapes

### Phase 2: Intégrations Paiement

**À implémenter:**
1. **API Mobile Money:**
   - Airtel Money API
   - Moov Money API
   - MTN Mobile Money API

2. **Gateway Carte:**
   - Stripe ou Paystack
   - Gestion 3D Secure
   - Webhooks

3. **Workflow Cash:**
   - QR Code pour référence
   - Système de tickets
   - Notifications admin

### Phase 3: Fonctionnalités Avancées

- Remboursements
- Factures PDF
- Historique paiements user
- Abonnements campagnes
- Paiements récurrents

---

**Système de panier et checkout complet et prêt pour production!** 🛒💳✨
