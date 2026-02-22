# Guide Complet du Système de Paiement - DriveBy Africa

> Ce guide détaille l'intégration E-Billing avec toutes les clés d'accès, les requêtes HTTP exactes et les données envoyées. Réutilisable pour un autre projet.

---

## 1. Credentials & Configuration

### E-Billing (Passerelle de paiement)

```
URL API        : https://stg.billing-easy.com/api/v1/merchant/e_bills
URL Portail    : https://staging.billing-easy.net
Utilisateur    : Sowax
Clé API        : ca492d78-cbeb-4513-9525-c23b8f0ce0c1
Auth           : Basic (base64 de "Sowax:ca492d78-cbeb-4513-9525-c23b8f0ce0c1")
```

### Backend PHP (Suivi des transactions)

```
URL Backend    : https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment
Endpoint init  : /init.php          (POST - créer une transaction)
Endpoint check : /check_status.php  (GET  - vérifier le statut)
```

### Méthodes de paiement supportées

- **Mobile Money** : Airtel Money, Moov Money
- **Cartes** : Visa, Mastercard
- **Devise** : XAF (Franc CFA)

---

## 2. Authentification E-Billing

L'API E-Billing utilise **Basic Authentication**. Le header est construit comme suit :

```typescript
// Credentials
const USER = 'Sowax';
const KEY  = 'ca492d78-cbeb-4513-9525-c23b8f0ce0c1';

// Encodage Base64 de "Sowax:ca492d78-cbeb-4513-9525-c23b8f0ce0c1"
const auth = `Basic ${base64Encode(`${USER}:${KEY}`)}`;

// Fonction base64 compatible React Native (pas de btoa natif)
function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const b1 = str.charCodeAt(i);
    const b2 = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const b3 = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
    output += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)];
    output += i + 1 < str.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    output += i + 2 < str.length ? chars[b3 & 63] : '=';
  }
  return output;
}
```

---

## 3. Flux Complet du Paiement

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  INIT    │───▶│ E-BILLING│───▶│ WEBVIEW  │───▶│ POLLING  │───▶│ COMMANDE │
│ (PHP)    │    │ (facture)│    │ (portail)│    │ (statut) │    │ (créer)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

---

## 4. Étape 1 : Initialisation sur le Backend PHP

### Requête HTTP

```http
POST https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment/init.php
Content-Type: application/json
```

### Body JSON envoyé

```json
{
  "user_id": "uuid-de-lutilisateur",
  "amount": 605000,
  "phone_number": "24174123456",
  "payment_system": "ebilling",
  "transaction_type": "deposit",
  "currency": "XAF",
  "description": "Acompte devis DBA-2025-0042 - Hyundai Tucson",
  "external_reference": "DBA_1738934521234_0042"
}
```

### Détail des champs

| Champ | Type | Description | Exemple |
|-------|------|-------------|---------|
| `user_id` | string | UUID de l'utilisateur (Supabase auth) | `"a1b2c3d4-..."` |
| `amount` | number | Montant en XAF (arrondi, entier) | `605000` |
| `phone_number` | string | Téléphone au format 241 (Gabon) | `"24174123456"` |
| `payment_system` | string | Toujours `"ebilling"` | `"ebilling"` |
| `transaction_type` | string | Type de transaction | `"deposit"` |
| `currency` | string | Toujours `"XAF"` | `"XAF"` |
| `description` | string | Description (max 100 chars) | `"Acompte devis DBA-..."` |
| `external_reference` | string | Référence unique générée | `"DBA_1738934521234_0042"` |

### Réponse attendue (succès)

```json
{
  "success": true,
  "data": {
    "mysql_id": 12345
  }
}
```

### Réponse attendue (erreur)

```json
{
  "success": false,
  "message": "Erreur lors de l'initialisation de la transaction"
}
```

### Génération de la référence externe

```typescript
function generateExternalReference(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DBA_${timestamp}_${random}`;
}
// Exemple : "DBA_1738934521234_0042"
```

### Formatage du numéro de téléphone

```typescript
function formatPhoneNumber(phone?: string): string {
  if (!phone) return '24174000000'; // Défaut Gabon

  let cleaned = phone.replace(/\D/g, ''); // Supprime tout sauf les chiffres

  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);   // 00241... → 241...
  if (cleaned.startsWith('241')) return cleaned;                   // Déjà au bon format
  if (cleaned.startsWith('0')) return '241' + cleaned.substring(1); // 074... → 24174...

  return '241' + cleaned; // 74... → 24174...
}
```

---

## 5. Étape 2 : Création de la Facture E-Billing

### Requête HTTP

```http
POST https://stg.billing-easy.com/api/v1/merchant/e_bills
Content-Type: application/json
Accept: application/json
Authorization: Basic U293YXg6Y2E0OTJkNzgtY2JlYi00NTEzLTk1MjUtYzIzYjhmMGNlMGMx
```

> Le header Authorization est le Base64 de `Sowax:ca492d78-cbeb-4513-9525-c23b8f0ce0c1`

### Body JSON envoyé

```json
{
  "payer_email": "client@email.com",
  "payer_msisdn": "24174123456",
  "amount": 605000,
  "short_description": "Acompte devis DBA-2025-0042 - Hyundai Tucson",
  "external_reference": "DBA_1738934521234_0042",
  "payer_name": "Client Driveby Africa",
  "expiry_period": 60,
  "currency": "XAF"
}
```

### Détail des champs

| Champ | Type | Obligatoire | Description | Exemple |
|-------|------|-------------|-------------|---------|
| `payer_email` | string | Oui | Email du client. Si absent : `user_{userId}@drivebyafrica.com` | `"client@email.com"` |
| `payer_msisdn` | string | Oui | Numéro au format international (241) | `"24174123456"` |
| `amount` | number | Oui | Montant en XAF (entier arrondi) | `605000` |
| `short_description` | string | Oui | Description (max 100 chars) | `"Acompte devis..."` |
| `external_reference` | string | Oui | Référence unique (même que init.php) | `"DBA_1738934521234_0042"` |
| `payer_name` | string | Oui | Nom affiché | `"Client Driveby Africa"` |
| `expiry_period` | number | Oui | Durée de validité en jours | `60` |
| `currency` | string | Oui | Devise | `"XAF"` |

### Réponse attendue (succès)

```json
{
  "e_bill": {
    "bill_id": "EBILL-123456789"
  }
}
```

> Le `bill_id` est utilisé pour construire l'URL du portail de paiement.

### Réponse attendue (erreur)

```json
{
  "message": "E-Billing API error: 422"
}
```

---

## 6. Étape 3 : Portail de Paiement (WebView)

### URL du portail

```
https://staging.billing-easy.net/?invoice={bill_id}
```

Exemple :
```
https://staging.billing-easy.net/?invoice=EBILL-123456789
```

### Composant WebView (React Native)

Le portail est affiché dans un `WebView` plein écran via un `Modal`. L'utilisateur choisit son mode de paiement (Mobile Money ou Carte) directement sur le portail E-Billing.

### Détection automatique du résultat

On surveille les changements d'URL dans le WebView :

```typescript
const handleNavigationStateChange = (navState: WebViewNavigation) => {
  const url = navState.url.toLowerCase();

  // SUCCÈS - l'URL contient un de ces mots-clés
  if (
    url.includes('remerciement') ||
    url.includes('callback') ||
    url.includes('success') ||
    url.includes('complete')
  ) {
    onClose(); // Ferme le WebView → passe à la vérification
  }

  // ÉCHEC / ANNULATION
  if (url.includes('cancel') || url.includes('error') || url.includes('failed')) {
    onCancel(); // Ferme avec erreur
  }
};
```

### Config du WebView

```typescript
<WebView
  source={{ uri: portalUrl }}
  onNavigationStateChange={handleNavigationStateChange}
  javaScriptEnabled={true}
  domStorageEnabled={true}
  startInLoadingState={true}
  scalesPageToFit={true}
  allowsInlineMediaPlayback={true}
  mediaPlaybackRequiresUserAction={false}
/>
```

### UI du WebView

- **Header noir** : icône cadenas vert + "Paiement sécurisé" + bouton "Annuler" (rouge)
- **Footer** : "Transaction sécurisée par E-Billing" + instruction "Validez avec le code USSD"
- **Loading** : overlay sombre avec spinner orange pendant le chargement

---

## 7. Étape 4 : Vérification du Paiement (Polling)

### Requête HTTP

```http
GET https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment/check_status.php?external_reference=DBA_1738934521234_0042
```

### Paramètres de polling

```typescript
const MAX_ATTEMPTS = 60;      // Maximum 60 tentatives
const POLL_INTERVAL = 3000;   // Toutes les 3 secondes
// Durée totale max : 60 × 3s = 3 minutes
```

### Réponse attendue (succès)

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "amount": 605000,
    "wallet_credited": true
  }
}
```

### Réponse attendue (en cours)

```json
{
  "success": true,
  "data": {
    "status": "pending"
  }
}
```

### Statuts possibles

| Statut | Signification | Action |
|--------|---------------|--------|
| `pending` | En attente du paiement | Continue le polling |
| `processing` | Paiement en cours de traitement | Continue le polling |
| `completed` | Paiement confirmé | Arrête le polling → crée la commande |
| `failed` | Paiement échoué | Arrête le polling → affiche erreur |
| `cancelled` | Paiement annulé par l'utilisateur | Arrête le polling → affiche erreur |
| `expired` | Transaction expirée | Arrête le polling → affiche erreur |

### Logique de polling complète

```typescript
const startPolling = () => {
  let currentAttempt = 0;

  const checkStatus = async () => {
    currentAttempt++;

    const result = await checkPaymentStatus(externalReference);

    // ✅ Paiement confirmé
    if (result.status === 'completed') {
      stopPolling();
      // Attendre 1.5s pour montrer l'animation de succès
      setTimeout(() => onSuccess(result), 1500);
      return;
    }

    // ❌ Échec ou annulation
    if (result.status === 'failed' || result.status === 'cancelled') {
      stopPolling();
      return;
    }

    // ⏰ Timeout atteint
    if (currentAttempt >= MAX_ATTEMPTS) {
      stopPolling();
      onTimeout();
      return;
    }

    // 🔄 Continue le polling
    setTimeout(checkStatus, POLL_INTERVAL);
  };

  // Premier check après 1 seconde
  setTimeout(checkStatus, 1000);
};
```

### UI de vérification

| Phase | Icône | Message |
|-------|-------|---------|
| Tentatives 1-5 | Spinner orange rotatif | "Vérification du paiement en cours..." |
| Tentatives 6-10 | Spinner orange rotatif | "Validation du paiement... Veuillez patienter." |
| Tentatives 11+ | Spinner + barre de progression | "Vérification en cours... (15/60)" |
| Succès | Checkmark vert (cercle) | "Paiement confirmé !" |
| Échec | Croix rouge (cercle) | "Le paiement a échoué ou a été annulé." |
| Timeout | Horloge orange (cercle) | "Délai de vérification dépassé." |

---

## 8. Étape 5 : Création de la Commande

Après confirmation du paiement, une commande est créée dans Supabase :

### Données envoyées à Supabase

```typescript
{
  // Lien avec le devis
  quoteId: "uuid-du-devis",

  // Infos véhicule
  vehicleId: "uuid-du-vehicule",
  vehicleMake: "Hyundai",
  vehicleModel: "Tucson",
  vehicleYear: 2023,
  vehicleSource: "korea",           // "korea" | "china" | "dubai"
  vehiclePriceUsd: 15000,

  // Destination
  destinationName: "Libreville",
  destinationCountry: "Gabon",
  shippingType: "container",        // "container" | "groupage"

  // Coûts
  shippingCostXaf: 2500000,
  insuranceCostXaf: 150000,
  totalCostXaf: 12500000,

  // Dépôt/Acompte
  depositAmountUsd: 1000,           // Fixe : $1,000
  depositAmountXaf: 605000,         // Converti en XAF
  depositPaymentReference: "DBA_1738934521234_0042",
  depositPaymentMethod: "mobile_money",  // "mobile_money" | "demo"

  // Client
  customerName: "Jean Dupont",
  customerEmail: "jean@email.com",
  customerWhatsapp: "+24174123456"
}
```

### Actions serveur après création

1. La commande est créée avec le statut initial `deposit_paid`
2. Les champs `deposit_paid_at`, `deposit_payment_method`, `deposit_payment_reference` sont enregistrés
3. Une entrée de suivi est créée : `{ status: "deposit_paid", notes: "Acompte payé" }`
4. Le devis est mis à jour : `status → "accepted"`

---

## 9. Code Source Complet : `lib/payment.ts`

```typescript
/**
 * Payment Service - E-Billing Integration
 * Le portail E-Billing gère le choix du mode de paiement (Mobile Money, Carte)
 */

// ═══════════════════════════════════════════════
// CONFIGURATION - Modifier ces valeurs pour votre app
// ═══════════════════════════════════════════════
const EBILLING = {
  URL: 'https://stg.billing-easy.com/api/v1/merchant/e_bills',
  PORTAL: 'https://staging.billing-easy.net',
  USER: 'Sowax',
  KEY: 'ca492d78-cbeb-4513-9525-c23b8f0ce0c1',
};

const BACKEND_URL = 'https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment';

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface PaymentResult {
  billId: string;
  externalReference: string;
  portalUrl: string;
}

export interface PaymentStatusResult {
  completed: boolean;
  status: PaymentStatus;
  walletCredited?: boolean;
}

// ═══════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════

/** Encode Base64 (compatible React Native sans btoa) */
function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const b1 = str.charCodeAt(i);
    const b2 = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const b3 = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
    output += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)];
    output += i + 1 < str.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    output += i + 2 < str.length ? chars[b3 & 63] : '=';
  }
  return output;
}

/** Référence unique : DBA_{timestamp}_{random4digits} */
function generateExternalReference(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `DBA_${timestamp}_${random}`;
}

/** Formate le téléphone au format Gabon (241) */
function formatPhoneNumber(phone?: string): string {
  if (!phone) return '24174000000';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  if (cleaned.startsWith('241')) return cleaned;
  if (cleaned.startsWith('0')) return '241' + cleaned.substring(1);
  return '241' + cleaned;
}

// ═══════════════════════════════════════════════
// FONCTION PRINCIPALE : CRÉER UN PAIEMENT
// ═══════════════════════════════════════════════

export async function createPayment(
  userId: string,
  amount: number,        // Montant en XAF
  description: string,   // Ex: "Acompte devis DBA-2025-0042 - Hyundai Tucson"
  userEmail?: string,
  phoneNumber?: string
): Promise<PaymentResult> {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const externalReference = generateExternalReference();

  // ── ÉTAPE 1 : Enregistrer la transaction dans le backend PHP ──
  const initResponse = await fetch(`${BACKEND_URL}/init.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      amount: Math.round(amount),
      phone_number: formattedPhone,
      payment_system: 'ebilling',
      transaction_type: 'deposit',
      currency: 'XAF',
      description: description.substring(0, 100),
      external_reference: externalReference,
    }),
  });

  const initData = await initResponse.json();

  if (!initData.success) {
    throw new Error(initData.message || "Erreur lors de l'initialisation");
  }

  // ── ÉTAPE 2 : Créer la facture E-Billing ──
  const auth = `Basic ${base64Encode(`${EBILLING.USER}:${EBILLING.KEY}`)}`;

  const ebillingResponse = await fetch(EBILLING.URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({
      payer_email: userEmail || `user_${userId}@drivebyafrica.com`,
      payer_msisdn: formattedPhone,
      amount: Math.round(amount),
      short_description: description.substring(0, 100),
      external_reference: externalReference,
      payer_name: 'Client Driveby Africa',
      expiry_period: 60,
      currency: 'XAF',
    }),
  });

  const ebillingData = await ebillingResponse.json();

  if (!ebillingResponse.ok) {
    throw new Error(ebillingData.message || `E-Billing error: ${ebillingResponse.status}`);
  }

  const billId = ebillingData.e_bill?.bill_id;

  if (!billId) {
    throw new Error('No bill_id returned from E-Billing');
  }

  // ── ÉTAPE 3 : Retourner l'URL du portail ──
  return {
    billId,
    externalReference,
    portalUrl: `${EBILLING.PORTAL}/?invoice=${billId}`,
  };
}

// ═══════════════════════════════════════════════
// FONCTION : VÉRIFIER LE STATUT DU PAIEMENT
// ═══════════════════════════════════════════════

export async function checkPaymentStatus(externalReference: string): Promise<PaymentStatusResult> {
  try {
    const url = `${BACKEND_URL}/check_status.php?external_reference=${externalReference}`;
    const response = await fetch(url);
    const responseData = await response.json();

    if (!responseData.success) {
      return { completed: false, status: 'pending' };
    }

    const status = responseData.data?.status || 'pending';

    return {
      completed: status === 'completed',
      status: status as PaymentStatus,
      walletCredited: responseData.data?.wallet_credited,
    };
  } catch (error) {
    return { completed: false, status: 'pending' };
  }
}
```

---

## 10. Résumé des Requêtes HTTP

### 1. Initialiser la transaction (Backend PHP)

```
POST https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment/init.php
Content-Type: application/json

{
  "user_id": "...",
  "amount": 605000,
  "phone_number": "24174123456",
  "payment_system": "ebilling",
  "transaction_type": "deposit",
  "currency": "XAF",
  "description": "Acompte devis...",
  "external_reference": "DBA_1738934521234_0042"
}

→ Réponse: { "success": true, "data": { "mysql_id": 12345 } }
```

### 2. Créer la facture (E-Billing API)

```
POST https://stg.billing-easy.com/api/v1/merchant/e_bills
Content-Type: application/json
Accept: application/json
Authorization: Basic U293YXg6Y2E0OTJkNzgtY2JlYi00NTEzLTk1MjUtYzIzYjhmMGNlMGMx

{
  "payer_email": "client@email.com",
  "payer_msisdn": "24174123456",
  "amount": 605000,
  "short_description": "Acompte devis...",
  "external_reference": "DBA_1738934521234_0042",
  "payer_name": "Client Driveby Africa",
  "expiry_period": 60,
  "currency": "XAF"
}

→ Réponse: { "e_bill": { "bill_id": "EBILL-123456789" } }
```

### 3. Ouvrir le portail de paiement

```
URL WebView: https://staging.billing-easy.net/?invoice=EBILL-123456789
```

### 4. Vérifier le statut (polling toutes les 3s, max 60 fois)

```
GET https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment/check_status.php?external_reference=DBA_1738934521234_0042

→ Réponse: { "success": true, "data": { "status": "completed", "wallet_credited": true } }
```

---

## 11. Mode Démo (Développement)

Pour tester sans passer par le portail :

```typescript
// Simule un paiement réussi après 2 secondes
const handleDemoPayment = async () => {
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Crée la commande directement
  await createOrder({
    ...orderData,
    depositPaymentReference: 'DEMO',
    depositPaymentMethod: 'demo',
  });
};
```

---

## 12. Schéma Base de Données (Supabase)

### Table `orders`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | ID unique |
| `user_id` | uuid | Référence utilisateur |
| `quote_id` | uuid | Référence au devis |
| `vehicle_id` | uuid | Référence au véhicule |
| `status` | text | Statut du workflow (13 étapes) |
| `deposit_amount_usd` | numeric | Acompte en USD (1000) |
| `deposit_amount_xaf` | numeric | Acompte en XAF |
| `deposit_paid_at` | timestamptz | Date du paiement |
| `deposit_payment_method` | text | `mobile_money` ou `demo` |
| `deposit_payment_reference` | text | Référence E-Billing |
| `total_cost_xaf` | numeric | Coût total en XAF |
| `shipping_cost_xaf` | numeric | Frais d'expédition |
| `insurance_cost_xaf` | numeric | Frais d'assurance |

### Table `order_tracking`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | ID unique |
| `order_id` | uuid | Référence à la commande |
| `status` | text | Étape du workflow |
| `notes` | text | Description |
| `completed_at` | timestamptz | Date de complétion |
| `created_at` | timestamptz | Date de création |

### Table `quotes`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | ID unique |
| `user_id` | uuid | Référence utilisateur |
| `status` | text | `pending`, `validated`, `accepted`, `rejected`, `expired` |
| `total_cost_xaf` | numeric | Coût total estimé |
| `valid_until` | timestamptz | Expiration (7 jours) |
| `quote_number` | text | Numéro unique (DBA-2025-XXXX) |

### Workflow des 13 statuts de commande

```
deposit_paid → vehicle_locked → inspection_sent → full_payment_received
→ vehicle_purchased → export_customs → in_transit → at_port
→ shipping → documents_ready → customs → ready_pickup → delivered
```

---

## 13. Pour Intégrer dans une Autre App

### Ce qu'il faut réutiliser tel quel :

1. **`lib/payment.ts`** — Copier le fichier entier, modifier uniquement les constantes `EBILLING` et `BACKEND_URL`
2. **`components/payment/PaymentWebView.tsx`** — Le composant WebView est générique
3. **`components/payment/PaymentVerificationView.tsx`** — Le polling est générique

### Ce qu'il faut adapter :

1. **La description** du paiement (champ `description` / `short_description`)
2. **Le `payer_name`** — remplacer "Client Driveby Africa" par votre nom
3. **L'email par défaut** — remplacer `@drivebyafrica.com`
4. **Le préfixe de référence** — remplacer `DBA_` par votre préfixe
5. **Le `transaction_type`** — adapter selon votre besoin (`deposit`, `payment`, etc.)
6. **Le montant** — calculer selon votre logique métier
7. **L'action post-paiement** — remplacer la création de commande par votre logique