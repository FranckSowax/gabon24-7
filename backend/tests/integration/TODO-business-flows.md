# Tests d'intégration métier à écrire (placeholders)

Ces 3 tests sont prévus par le plan d'audit (M0-4) mais nécessitent une infrastructure
de test plus complète (Supabase de test ou mocks profonds). À implémenter dans la suite.

## 1. `auth-flow.test.js` — flow signup + signin

**Objectif** : valider qu'un nouvel utilisateur peut s'inscrire et se reconnecter.

**Steps** :
1. `POST /api/auth/signup` avec un email unique → 201 + tokens.
2. `POST /api/auth/signin` avec ces creds → 200 + access_token.
3. Avec ce access_token, `GET /api/users/me` → 200 + profil.

**Pré-requis** :
- Supabase de test isolé OU mock complet du client Supabase (`jest.mock('../supabase-config')`).
- Mock de Cloudflare Turnstile (`process.env.SKIP_TURNSTILE_IN_TEST=1`).

---

## 2. `credits-flow.test.js` — crédits IA atomiques

**Objectif** : un user authentifié peut consommer un crédit, et la transaction est tracée.

**Steps** :
1. Setup : user authentifié avec 100 crédits via mock.
2. `POST /api/ai/analyze-article` (ou équivalent) → 200, déduit N crédits.
3. `GET /api/credits/balance` → balance = 100 - N.
4. `GET /api/credits/transactions` → la transaction est listée avec `balance_after = 100 - N`.
5. Edge case : crédit insuffisant → 402 + transaction non créée.

**Pré-requis** :
- Mock Supabase RPC `decrement_credits` (ou table mockée avec triggers simulés).
- Mock du provider IA (OpenAI/Gemini) pour éviter les coûts.

---

## 3. `whatsapp-flow.test.js` — envoi article sur la chaîne

**Objectif** : un article éligible est posté sur la chaîne WhatsApp, et `whatsapp_sent` passe à `true`.

**Steps** :
1. Mock `axios.post` pour intercepter les appels à `gate.whapi.cloud`.
2. Setup : un article avec `whatsapp_sent=false`, `summary_ai='…'`, dans la fenêtre WHATSAPP_START.
3. Appeler `whapiService.sendPendingArticles(1)`.
4. Assertions :
   - 1 appel à Whapi `/messages/image` (si image) ou `/messages/text`.
   - L'article est mis à jour `whatsapp_sent=true` dans le mock Supabase.
   - Le retour est `{ sent: 1, errors: 0 }`.
5. Edge case quota OpenAI 429 → l'envoi se fait quand même, sans bloc opportunités (régression observée le 2026-06-02).

**Pré-requis** :
- `jest.mock('axios')` pour Whapi.
- `jest.mock('openai')` pour simuler le 429.
- Mock Supabase `from('articles').select/update`.

---

## Référence

- Setup commun : voir `tests/setup.js` qui configure déjà les env vars de test.
- Helper recommandé : créer `tests/helpers/mockSupabase.js` qui retourne un client factice
  avec `from(...).select/insert/update/delete()` chainable.
