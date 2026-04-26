# Guide Complet : Flux de Paiement E-Billing

> Ce guide explique en detail le parcours complet du paiement, depuis le clic sur le bouton "Payer" jusqu'a la verification finale. Focalisé uniquement sur la mecanique de paiement, independamment de la logique metier.

---

## ⚠️ REGLE OBLIGATOIRE — LIRE AVANT TOUTE IMPLEMENTATION ⚠️

> **L'appel a `init.php` est la PREMIERE etape OBLIGATOIRE de tout paiement. AUCUNE facture E-Billing ne doit etre creee sans avoir d'abord initialise la transaction via `init.php`.**

### Pourquoi c'est CRITIQUE :

L'appel `POST ${BACKEND_URL}/init.php` **DOIT** etre execute AVANT l'appel a l'API E-Billing (`e_bills`). Ce n'est PAS optionnel. Sans cet appel :
- La transaction n'existe PAS dans notre base MySQL
- Le `check_status.php` ne pourra JAMAIS retrouver la transaction (il cherche par `external_reference` dans MySQL)
- Le polling de verification echouera systematiquement
- Le paiement sera perdu sans aucune trace cote backend

### Ordre STRICT des appels (ne JAMAIS changer) :

```
1. ✅ OBLIGATOIRE — POST init.php          → Enregistre la transaction dans MySQL, retourne mysql_id
2. ✅ OBLIGATOIRE — Verifier init.success   → Si false, ARRETER ICI, ne PAS continuer
3. ✅ OBLIGATOIRE — POST e_bills            → Cree la facture E-Billing (SEULEMENT si init a reussi)
4. ✅ OBLIGATOIRE — Ouvrir le portail       → WebView avec l'URL du portail
5. ✅ OBLIGATOIRE — GET check_status.php    → Polling pour verifier le statut (fonctionne GRACE a init.php)
```

### Implementation MINIMALE attendue dans `handlePayment()` :

```typescript
async function handlePayment() {
  const externalReference = generateExternalReference();

  // ══════════════════════════════════════════════════════════════
  // ETAPE 1 — INITIALISATION BACKEND (init.php) — OBLIGATOIRE
  // Cette etape DOIT etre la premiere. Elle enregistre la
  // transaction dans MySQL. Sans elle, check_status.php ne
  // fonctionnera pas et le paiement sera impossible a tracer.
  // ══════════════════════════════════════════════════════════════
  const initResponse = await fetch(`${BACKEND_URL}/init.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      amount: Math.round(amountXAF),
      phone_number: formatPhoneNumber(phone),
      payment_system: 'ebilling',
      transaction_type: 'deposit',   // ou 'payment', 'subscription' selon le contexte
      currency: 'XAF',
      description: description.substring(0, 100),
      external_reference: externalReference,
    }),
  });

  const initData = await initResponse.json();

  // ══════════════════════════════════════════════════════════════
  // VERIFICATION — Si init.php echoue, on ARRETE TOUT.
  // Ne JAMAIS continuer vers E-Billing sans un init reussi.
  // ══════════════════════════════════════════════════════════════
  if (!initData.success) {
    throw new Error(initData.message || "Erreur lors de l'initialisation");
  }

  // SEULEMENT APRES le succes de init.php :
  // → Appel E-Billing (e_bills)
  // → Ouverture du portail (WebView)
  // → Polling (check_status.php)
}
```

### Erreurs FREQUENTES a NE PAS reproduire :

| ❌ ERREUR | ✅ CORRECTION |
|-----------|--------------|
| Appeler E-Billing (`e_bills`) SANS appeler `init.php` d'abord | TOUJOURS appeler `init.php` EN PREMIER |
| Ignorer la reponse de `init.php` et continuer meme si `success: false` | Verifier `initData.success` et ARRETER si `false` |
| Creer le paiement directement dans Supabase sans passer par `init.php` | `init.php` est le SEUL point d'entree pour initialiser un paiement |
| Mettre l'appel `init.php` en commentaire ou le considerer comme optionnel | L'appel est OBLIGATOIRE, sans exception |
| Utiliser une autre URL que `${BACKEND_URL}/init.php` pour l'initialisation | L'URL est toujours `${BACKEND_URL}/init.php` |

---

## 1. Vue d'ensemble : Ce qui se passe quand l'utilisateur clique "Payer"

Quand l'utilisateur appuie sur le bouton de paiement, voici la chaine complete d'evenements :

```
 UTILISATEUR                        APP                          SERVEURS
 ───────────                        ───                          ────────
     │                               │                              │
     │  1. Clique "Payer"            │                              │
     │──────────────────────────────▶│                              │
     │                               │  2. POST init.php            │
     │                               │─────────────────────────────▶│ Backend PHP
     │                               │  ◀─ { mysql_id: 12345 }     │
     │                               │                              │
     │                               │  3. POST e_bills             │
     │                               │─────────────────────────────▶│ API E-Billing
     │                               │  ◀─ { bill_id: "EBILL-..." }│
     │                               │                              │
     │  4. Portail s'ouvre (WebView) │                              │
     │◀──────────────────────────────│                              │
     │                               │                              │
     │  5. Choisit Mobile Money      │                              │
     │     ou Carte bancaire         │                              │
     │  6. Valide le paiement        │                              │
     │     (code USSD / 3D Secure)   │                              │
     │                               │                              │
     │  7. Portail redirige          │                              │
     │     vers page "remerciement"  │                              │
     │──────────────────────────────▶│                              │
     │                               │  8. GET check_status.php     │
     │                               │─────────────────────────────▶│ Backend PHP
     │                               │  ◀─ { status: "pending" }   │
     │                               │     ... (polling 3s)         │
     │                               │  ◀─ { status: "completed" } │
     │                               │                              │
     │  9. "Paiement confirmé !"     │                              │
     │◀──────────────────────────────│                              │
```

---

## 2. Etape par etape : Le bouton "Payer"

### 2.1. L'utilisateur clique sur le bouton

Le bouton declenche la fonction `handlePayment()`. A ce moment-la, l'app possede deja :
- L'**identifiant utilisateur** (UUID de l'auth)
- Le **montant a payer** en XAF (entier arrondi)
- L'**email** et le **telephone** du client
- Une **description** du paiement

Le bouton passe en etat "loading" (spinner + texte grise) pour empecher les doubles clics.

### 2.2. Ce que fait `handlePayment()` en coulisses

La fonction execute **2 appels API sequentiels** avant d'ouvrir le portail :

```
handlePayment()
  │
  ├── 1. Generer une reference unique (ex: "REF_1738934521234_0042")
  │
  ├── 2. Appel POST → Backend PHP (init.php)
  │      → Enregistre la transaction dans la base MySQL
  │      → Retourne un ID MySQL
  │      → Si ECHEC : affiche erreur, arrete tout
  │
  ├── 3. Appel POST → API E-Billing (e_bills)
  │      → Cree une "facture electronique" chez E-Billing
  │      → Retourne un bill_id (ex: "EBILL-123456789")
  │      → Si ECHEC : affiche erreur, arrete tout
  │
  └── 4. Construit l'URL du portail :
         https://staging.billing-easy.net/?invoice=EBILL-123456789
         → Ouvre le WebView (Modal plein ecran)
```

---

## 3. Appel 1 : Initialisation Backend (init.php)

### Pourquoi cet appel ?

Avant de contacter E-Billing, on enregistre la transaction dans **notre propre base de donnees**. Cela permet de :
- Garder une trace de chaque tentative de paiement
- Avoir un `external_reference` unique pour le suivi
- Pouvoir verifier le statut plus tard via `check_status.php`

### La reference externe

C'est la **cle de voute** de tout le systeme. Elle lie les 3 acteurs (Backend PHP, E-Billing, et l'app) ensemble :

```typescript
function generateExternalReference(): string {
  const timestamp = Date.now();                    // 1738934521234
  const random = Math.floor(Math.random() * 10000)
    .toString().padStart(4, '0');                  // "0042"
  return `PREFIX_${timestamp}_${random}`;          // "PREFIX_1738934521234_0042"
}
```

Cette reference est :
- **Generee cote client** (dans l'app mobile)
- **Envoyee a init.php** pour etre stockee en MySQL
- **Envoyee a E-Billing** pour etre attachee a la facture
- **Utilisee pour le polling** (check_status.php?external_reference=...)

### Requete HTTP exacte

```http
POST https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment/init.php
Content-Type: application/json
```

```json
{
  "user_id": "uuid-de-lutilisateur",
  "amount": 605000,
  "phone_number": "24174123456",
  "payment_system": "ebilling",
  "transaction_type": "deposit",
  "currency": "XAF",
  "description": "Description du paiement (max 100 caracteres)",
  "external_reference": "PREFIX_1738934521234_0042"
}
```

### Detail de chaque champ

| Champ | Type | Description |
|-------|------|-------------|
| `user_id` | string | UUID de l'utilisateur authentifie |
| `amount` | number | Montant en XAF, arrondi a l'entier (`Math.round()`) |
| `phone_number` | string | Telephone au format international sans `+` (ex: `"24174123456"`) |
| `payment_system` | string | Toujours `"ebilling"` — identifie la passerelle utilisee |
| `transaction_type` | string | Type de paiement (ex: `"deposit"`, `"payment"`, `"subscription"`) |
| `currency` | string | Devise — `"XAF"` pour le Franc CFA |
| `description` | string | Texte libre, tronque a 100 caracteres |
| `external_reference` | string | Reference unique generee (voir ci-dessus) |

### Formatage du telephone

Le telephone doit etre au format international Gabon (prefixe `241`) sans le `+` :

```typescript
function formatPhoneNumber(phone?: string): string {
  if (!phone) return '24174000000'; // Numero par defaut

  let cleaned = phone.replace(/\D/g, ''); // Garde uniquement les chiffres

  // Gere les differents formats d'entree :
  if (cleaned.startsWith('00'))  cleaned = cleaned.substring(2);    // 0024174... → 24174...
  if (cleaned.startsWith('241')) return cleaned;                     // Deja bon
  if (cleaned.startsWith('0'))   return '241' + cleaned.substring(1); // 074... → 24174...
  return '241' + cleaned;                                            // 74... → 24174...
}
```

**Exemples de conversion :**
```
+241 74 12 34 56  →  "24174123456"
074 12 34 56      →  "24174123456"
00241 74 12 34 56 →  "24174123456"
74 12 34 56       →  "24174123456"
```

### Reponses possibles

**Succes** — la transaction est enregistree, on peut continuer :
```json
{
  "success": true,
  "data": {
    "mysql_id": 12345
  }
}
```

**Echec** — on arrete tout et on affiche l'erreur a l'utilisateur :
```json
{
  "success": false,
  "message": "Erreur lors de l'initialisation de la transaction"
}
```

### Ce que fait init.php cote serveur

1. Recoit les donnees JSON
2. Valide que les champs requis sont presents
3. Insere une nouvelle ligne dans la table MySQL `transactions` avec le statut `pending`
4. Retourne l'ID MySQL de la ligne creee

---

## 4. Appel 2 : Creation de la facture E-Billing

### Pourquoi cet appel ?

E-Billing est la **passerelle de paiement**. Cet appel cree une "facture electronique" (e-bill) qui sera presentee a l'utilisateur sur le portail. Sans cette facture, le portail n'a rien a afficher.

### Authentification

L'API E-Billing utilise **Basic Authentication**. Le header `Authorization` est construit ainsi :

```
1. On prend les credentials : "Utilisateur:CleAPI"
   Exemple : "Sowax:ca492d78-cbeb-4513-9525-c23b8f0ce0c1"

2. On encode cette chaine en Base64
   Resultat : "U293YXg6Y2E0OTJkNzgtY2JlYi00NTEzLTk1MjUtYzIzYjhmMGNlMGMx"

3. On prefixe avec "Basic "
   Header final : "Basic U293YXg6Y2E0OTJkNzgtY2JlYi00NTEzLTk1MjUtYzIzYjhmMGNlMGMx"
```

En code (compatible React Native, sans `btoa` natif) :

```typescript
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

const auth = `Basic ${base64Encode('Utilisateur:CleAPI')}`;
```

### Requete HTTP exacte

```http
POST https://stg.billing-easy.com/api/v1/merchant/e_bills
Content-Type: application/json
Accept: application/json
Authorization: Basic U293YXg6Y2E0OTJkNzgtY2JlYi00NTEzLTk1MjUtYzIzYjhmMGNlMGMx
```

```json
{
  "payer_email": "client@email.com",
  "payer_msisdn": "24174123456",
  "amount": 605000,
  "short_description": "Description du paiement",
  "external_reference": "PREFIX_1738934521234_0042",
  "payer_name": "Nom du client",
  "expiry_period": 60,
  "currency": "XAF"
}
```

### Detail de chaque champ

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `payer_email` | string | Oui | Email du client (pour les notifications E-Billing) |
| `payer_msisdn` | string | Oui | Telephone au format international sans `+` |
| `amount` | number | Oui | Montant en XAF (entier arrondi) |
| `short_description` | string | Oui | Description affichee sur le portail (max 100 chars) |
| `external_reference` | string | Oui | **Meme reference** que celle envoyee a init.php |
| `payer_name` | string | Oui | Nom affiche sur la facture |
| `expiry_period` | number | Oui | Duree de validite de la facture en **jours** |
| `currency` | string | Oui | Devise du paiement (`"XAF"`) |

### Reponses possibles

**Succes** — la facture est creee, on recoit le `bill_id` :
```json
{
  "e_bill": {
    "bill_id": "EBILL-123456789"
  }
}
```

**Echec** — le serveur E-Billing refuse (donnees invalides, auth incorrecte, etc.) :
```json
{
  "message": "E-Billing API error: 422"
}
```

### Que se passe-t-il si cet appel echoue ?

- L'app affiche un message d'erreur a l'utilisateur
- Le WebView ne s'ouvre PAS
- La transaction reste en statut `pending` dans le backend PHP
- L'utilisateur peut reessayer (un nouveau `external_reference` sera genere)

---

## 5. Ouverture du portail de paiement (WebView)

### Construction de l'URL

A partir du `bill_id` recu d'E-Billing, on construit l'URL du portail :

```
https://staging.billing-easy.net/?invoice={bill_id}
```

Exemple concret :
```
https://staging.billing-easy.net/?invoice=EBILL-123456789
```

### Comment le portail s'ouvre

L'app ouvre un **Modal plein ecran** contenant un composant `WebView` (navigateur integre). L'utilisateur ne quitte jamais l'app — le portail E-Billing s'affiche a l'interieur.

```
┌─────────────────────────────────────┐
│  [cadenas] Paiement securise  [X]  │  ← Header de l'app (pas du portail)
├─────────────────────────────────────┤
│                                     │
│    ┌───────────────────────────┐    │
│    │                           │    │
│    │   PORTAIL E-BILLING       │    │
│    │                           │    │
│    │   Montant : 605 000 XAF   │    │
│    │                           │    │
│    │   [Airtel Money]          │    │  ← Contenu web du portail
│    │   [Moov Money]            │    │     (rendu par WebView)
│    │   [Visa/Mastercard]       │    │
│    │                           │    │
│    └───────────────────────────┘    │
│                                     │
│  Transaction securisee par E-Billing│  ← Footer de l'app
└─────────────────────────────────────┘
```

### Configuration technique du WebView

```typescript
<WebView
  source={{ uri: portalUrl }}                    // URL du portail
  onNavigationStateChange={handleNavChange}      // Surveille les redirections
  javaScriptEnabled={true}                       // Le portail utilise du JS
  domStorageEnabled={true}                       // Cookies/localStorage necessaires
  startInLoadingState={true}                     // Affiche un spinner au chargement
  scalesPageToFit={true}                         // Adapte le portail a l'ecran
  allowsInlineMediaPlayback={true}               // Autorise les medias inline
  mediaPlaybackRequiresUserAction={false}         // Pas besoin de clic pour les medias
/>
```

### Ce que l'utilisateur voit et fait sur le portail

1. **Page d'accueil du portail** : affiche le montant, la description, et les methodes de paiement
2. **L'utilisateur choisit** : Mobile Money (Airtel/Moov) OU Carte bancaire (Visa/MC)

**Si Mobile Money :**
   - L'utilisateur entre son numero de telephone
   - Il recoit un **code USSD** sur son telephone (push notification operateur)
   - Il compose le code USSD (ex: `*126*1*1#`) et entre son code PIN
   - L'operateur valide → le portail redirige vers une page de confirmation

**Si Carte bancaire :**
   - L'utilisateur entre ses infos carte (numero, expiration, CVV)
   - Redirection vers la page **3D Secure** de sa banque
   - Il entre le code OTP recu par SMS
   - La banque valide → le portail redirige vers une page de confirmation

### Detection automatique du resultat (cle du systeme)

Le WebView surveille **chaque changement d'URL** dans le portail. Quand le portail redirige apres le paiement, l'URL change et contient des mots-cles specifiques :

```typescript
const handleNavigationStateChange = (navState: WebViewNavigation) => {
  const url = navState.url.toLowerCase();

  // ═══ SUCCES ═══
  // Apres un paiement reussi, E-Billing redirige vers une URL contenant
  // un de ces mots-cles. On detecte la redirection et on ferme le WebView.
  if (
    url.includes('remerciement') ||  // Page de remerciement E-Billing
    url.includes('callback') ||      // URL de callback configuree
    url.includes('success') ||       // Page de succes generique
    url.includes('complete')         // Paiement complete
  ) {
    // Le paiement SEMBLE reussi (cote portail).
    // On ferme le WebView et on lance la VERIFICATION serveur.
    onClose();
    return;
  }

  // ═══ ECHEC / ANNULATION ═══
  // Si l'utilisateur annule ou si le paiement echoue,
  // le portail redirige vers une URL contenant ces mots-cles.
  if (
    url.includes('cancel') ||   // Annulation par l'utilisateur
    url.includes('error') ||    // Erreur de paiement
    url.includes('failed')      // Paiement refuse
  ) {
    onCancel(); // Ferme le WebView et affiche un message d'echec
    return;
  }

  // ═══ AUTRE ═══
  // Toute autre navigation (pages internes du portail) est ignoree.
  // L'utilisateur navigue librement dans le portail.
};
```

**IMPORTANT** : La detection par URL est une indication, PAS une confirmation. Le portail dit "merci" mais cela ne garantit PAS que l'argent a ete debite. C'est pourquoi l'etape suivante (polling/verification) est **obligatoire**.

### Cas ou l'utilisateur ferme manuellement

Si l'utilisateur clique le bouton "Annuler" (X) dans le header de l'app :
- Le Modal se ferme
- Le paiement est considere comme **annule**
- Aucune verification n'est lancee
- L'utilisateur peut reessayer plus tard

---

## 6. Verification du paiement (Polling)

### Pourquoi verifier ?

La redirection du portail (etape 5) indique seulement que l'utilisateur a **termine le parcours** sur le portail. Mais :
- Le debit Mobile Money peut prendre quelques secondes
- La validation bancaire peut etre asynchrone
- Le portail peut rediriger avant que le backend ait confirme

On doit donc **interroger notre backend PHP** de maniere repetee jusqu'a obtenir une reponse definitive.

### Comment fonctionne le polling

```
  Fermeture WebView
        │
        ▼
  Attendre 1 seconde (laisser le temps au serveur)
        │
        ▼
  ┌─────────────────────────────────────┐
  │  GET check_status.php               │
  │  ?external_reference=PREFIX_...     │
  └──────────────┬──────────────────────┘
                 │
        ┌────────┼────────┬────────────┐
        ▼        ▼        ▼            ▼
    "pending"  "processing" "completed" "failed"/"cancelled"/"expired"
        │        │           │            │
        ▼        ▼           ▼            ▼
   Attendre    Attendre   SUCCES !     ECHEC
   3 secondes  3 secondes  Arreter     Arreter
   et reessayer            le polling   le polling
        │        │
        ▼        ▼
   Tentative   Tentative
   suivante    suivante
   (max 60)    (max 60)
        │
        ▼
   Si 60 tentatives atteintes → TIMEOUT
```

### Requete HTTP

```http
GET https://emoneygabon.alwaysdata.net/la-map-gabon/api/payment/check_status.php?external_reference=PREFIX_1738934521234_0042
```

Aucun body, aucun header d'authentification. Juste un GET avec la reference en query string.

### Parametres de timing

```typescript
const MAX_ATTEMPTS  = 60;     // Nombre maximum de tentatives
const POLL_INTERVAL = 3000;   // 3 secondes entre chaque tentative
// Duree totale maximum : 60 x 3s = 3 minutes
```

### Les 6 statuts possibles

| Statut | Signification | Ce que fait l'app |
|--------|---------------|-------------------|
| `pending` | Le paiement n'a pas encore ete traite | Continue le polling (reessaie dans 3s) |
| `processing` | Le paiement est en cours de traitement par l'operateur/banque | Continue le polling (reessaie dans 3s) |
| `completed` | Le paiement a ete confirme et l'argent debite | **Arrete le polling** → affiche succes |
| `failed` | Le paiement a echoue (solde insuffisant, refus banque, etc.) | **Arrete le polling** → affiche erreur |
| `cancelled` | L'utilisateur a annule le paiement | **Arrete le polling** → affiche annulation |
| `expired` | La transaction a expire (delai depasse) | **Arrete le polling** → affiche expiration |

### Reponses HTTP

**En attente** (le polling continue) :
```json
{
  "success": true,
  "data": {
    "status": "pending"
  }
}
```

**Paiement confirme** (le polling s'arrete) :
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

**Echec** (le polling s'arrete) :
```json
{
  "success": true,
  "data": {
    "status": "failed"
  }
}
```

### Logique de polling complete (code)

```typescript
const startPolling = (externalReference: string) => {
  let currentAttempt = 0;

  const checkStatus = async () => {
    currentAttempt++;

    // Appel HTTP au backend
    const result = await checkPaymentStatus(externalReference);

    // ── CAS 1 : Paiement confirme ──
    if (result.status === 'completed') {
      stopPolling();
      // Pause de 1.5s pour montrer l'animation de succes (checkmark vert)
      setTimeout(() => onSuccess(result), 1500);
      return;
    }

    // ── CAS 2 : Echec ou annulation ──
    if (['failed', 'cancelled', 'expired'].includes(result.status)) {
      stopPolling();
      onError(result.status); // Affiche le message d'erreur adapte
      return;
    }

    // ── CAS 3 : Timeout (60 tentatives atteintes) ──
    if (currentAttempt >= MAX_ATTEMPTS) {
      stopPolling();
      onTimeout(); // "Delai de verification depasse"
      return;
    }

    // ── CAS 4 : En attente → on reessaie dans 3 secondes ──
    setTimeout(checkStatus, POLL_INTERVAL);
  };

  // Premier check apres 1 seconde (laisser le temps au serveur)
  setTimeout(checkStatus, 1000);
};
```

### Gestion des erreurs reseau pendant le polling

Si un appel a `check_status.php` echoue (timeout, erreur reseau, 500, etc.) :

```typescript
export async function checkPaymentStatus(externalReference: string): Promise<PaymentStatusResult> {
  try {
    const url = `${BACKEND_URL}/check_status.php?external_reference=${externalReference}`;
    const response = await fetch(url);
    const responseData = await response.json();

    if (!responseData.success) {
      // Le backend repond mais dit "pas de donnees" → on traite comme "pending"
      return { completed: false, status: 'pending' };
    }

    const status = responseData.data?.status || 'pending';

    return {
      completed: status === 'completed',
      status: status as PaymentStatus,
      walletCredited: responseData.data?.wallet_credited,
    };
  } catch (error) {
    // Erreur reseau, timeout, JSON invalide, etc.
    // On retourne "pending" pour que le polling CONTINUE
    // (on ne veut pas declarer un echec a cause d'un probleme reseau temporaire)
    return { completed: false, status: 'pending' };
  }
}
```

**Principe** : une erreur reseau n'est PAS un echec de paiement. Le polling continue jusqu'a obtenir une reponse definitive ou atteindre le timeout.

### Ce que voit l'utilisateur pendant le polling

L'ecran affiche une animation de verification avec des messages progressifs :

| Tentatives | Ce qui s'affiche |
|------------|-----------------|
| 1 a 5 | Spinner orange rotatif + "Verification du paiement en cours..." |
| 6 a 10 | Spinner orange rotatif + "Validation du paiement... Veuillez patienter." |
| 11 a 60 | Spinner + barre de progression + "Verification en cours... (15/60)" |
| **Succes** | Checkmark vert (animation cercle) + "Paiement confirme !" |
| **Echec** | Croix rouge (animation cercle) + "Le paiement a echoue ou a ete annule." |
| **Timeout** | Horloge orange (animation cercle) + "Delai de verification depasse." |

---

## 7. Ce que fait le backend PHP (check_status.php)

Quand l'app appelle `check_status.php`, voici ce qui se passe cote serveur :

```
  App mobile                    Backend PHP                    E-Billing
  ──────────                    ───────────                    ─────────
      │                              │                             │
      │  GET check_status.php        │                             │
      │  ?external_reference=...     │                             │
      │─────────────────────────────▶│                             │
      │                              │                             │
      │                              │  1. Cherche la transaction  │
      │                              │     dans MySQL par           │
      │                              │     external_reference       │
      │                              │                             │
      │                              │  2. E-Billing envoie un     │
      │                              │     webhook/callback au      │
      │                              │     backend quand le statut  │◀── Webhook
      │                              │     change (completed,       │
      │                              │     failed, etc.)            │
      │                              │                             │
      │                              │  3. Le backend retourne     │
      │  ◀───────────────────────────│     le statut MySQL         │
      │  { status: "completed" }     │     (mis a jour par le      │
      │                              │      webhook)               │
```

**Le backend ne contacte PAS E-Billing a chaque appel.** Il lit simplement le statut dans sa base MySQL. C'est E-Billing qui **pousse** les mises a jour via des webhooks.

---

## 8. Resume : Les 3 requetes HTTP du flux

### Requete 1 : Initialiser la transaction

```
POST /init.php
→ Enregistre la transaction dans MySQL
→ Retourne { success: true, data: { mysql_id: 12345 } }
```

### Requete 2 : Creer la facture E-Billing

```
POST /e_bills (avec Basic Auth)
→ Cree une e-facture chez E-Billing
→ Retourne { e_bill: { bill_id: "EBILL-123456789" } }
→ On construit l'URL du portail avec ce bill_id
```

### Requete 3 : Verifier le statut (x60 max)

```
GET /check_status.php?external_reference=...
→ Retourne { success: true, data: { status: "pending|completed|failed|..." } }
→ Repetee toutes les 3s jusqu'a un statut definitif
```

---

## 9. Code source complet : service de paiement

```typescript
/**
 * Service de paiement generique - Integration E-Billing
 * Le portail E-Billing gere le choix du mode de paiement (Mobile Money, Carte)
 */

// ═══════════════════════════════════════════════
// CONFIGURATION — Adapter ces valeurs a votre projet
// ═══════════════════════════════════════════════
const EBILLING = {
  URL:    'https://stg.billing-easy.com/api/v1/merchant/e_bills',  // Endpoint API
  PORTAL: 'https://staging.billing-easy.net',                       // Portail web
  USER:   'VotreUtilisateur',                                       // Login E-Billing
  KEY:    'votre-cle-api-ici',                                      // Cle API
};

const BACKEND_URL = 'https://votre-backend.com/api/payment';        // Votre backend PHP

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface PaymentResult {
  billId: string;             // ID de la facture E-Billing
  externalReference: string;  // Reference unique pour le suivi
  portalUrl: string;          // URL a ouvrir dans le WebView
}

export interface PaymentStatusResult {
  completed: boolean;         // true si status === 'completed'
  status: PaymentStatus;      // Statut detaille
  walletCredited?: boolean;   // true si l'argent a ete credite
}

// ═══════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════

/** Encode Base64 — compatible React Native (pas de btoa natif) */
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

/** Genere une reference unique : PREFIX_{timestamp}_{random4digits} */
function generateExternalReference(prefix: string = 'PAY'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}_${timestamp}_${random}`;
}

/** Formate un numero de telephone au format Gabon (241XXXXXXXX) */
function formatPhoneNumber(phone?: string): string {
  if (!phone) return '24174000000';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  if (cleaned.startsWith('241')) return cleaned;
  if (cleaned.startsWith('0')) return '241' + cleaned.substring(1);
  return '241' + cleaned;
}

// ═══════════════════════════════════════════════
// FONCTION PRINCIPALE : CREER UN PAIEMENT
// (Appels 1 et 2 : init.php + e_bills)
// ═══════════════════════════════════════════════

export async function createPayment(
  userId: string,
  amount: number,        // Montant en XAF
  description: string,   // Description affichee sur le portail
  userEmail?: string,     // Email du client
  phoneNumber?: string    // Telephone du client
): Promise<PaymentResult> {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const externalReference = generateExternalReference();

  // ── APPEL 1 : Enregistrer la transaction dans le backend PHP ──
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

  // ── APPEL 2 : Creer la facture E-Billing ──
  const auth = `Basic ${base64Encode(`${EBILLING.USER}:${EBILLING.KEY}`)}`;

  const ebillingResponse = await fetch(EBILLING.URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify({
      payer_email: userEmail || `user_${userId}@app.com`,
      payer_msisdn: formattedPhone,
      amount: Math.round(amount),
      short_description: description.substring(0, 100),
      external_reference: externalReference,
      payer_name: 'Client',
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

  // ── Retourner l'URL du portail ──
  return {
    billId,
    externalReference,
    portalUrl: `${EBILLING.PORTAL}/?invoice=${billId}`,
  };
}

// ═══════════════════════════════════════════════
// FONCTION : VERIFIER LE STATUT DU PAIEMENT
// (Appel 3 : check_status.php — appele en boucle)
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
    // Erreur reseau → on traite comme "pending" pour continuer le polling
    return { completed: false, status: 'pending' };
  }
}
```

---

## 10. Pour integrer dans une autre app

### Fichiers a reutiliser tels quels :

1. **Service de paiement** (`lib/payment.ts`) — copier et adapter les constantes `EBILLING` et `BACKEND_URL`
2. **Composant WebView** — le Modal + WebView avec detection d'URL est generique
3. **Ecran de verification** — le polling avec UI progressive est generique

### Ce qu'il faut adapter :

| Element | Quoi changer |
|---------|-------------|
| `EBILLING.USER` et `EBILLING.KEY` | Vos credentials E-Billing |
| `BACKEND_URL` | L'URL de votre backend PHP |
| `payer_name` | Le nom de votre application |
| `payer_email` (fallback) | Votre domaine email par defaut |
| Prefixe de reference | Remplacer `"PAY"` par votre prefixe |
| `transaction_type` | Adapter selon votre besoin (`"deposit"`, `"payment"`, `"subscription"`) |
| Le montant | Calculer selon votre logique metier |
| L'action post-paiement | Ce que vous faites apres `status: "completed"` |