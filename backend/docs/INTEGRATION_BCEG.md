# Intégration BCEG ↔ Gabon Insight

Ce document décrit l'intégration progressive (niveaux 1→4 du rapport) entre
l'application/back-office BCEG et Gabon Insight.

## Configuration (variables d'environnement Railway)

| Variable | Rôle |
|---|---|
| `BCEG_PARTNER_API_KEY` | Clé API machine-to-machine pour le back-office BCEG (niveau 4). **À générer et partager de façon sécurisée.** |
| `BCEG_PORTAL_CODE` | Code portail existant (alternative à la clé). |
| `BCEG_SSO_SECRET` | Secret HMAC pour le SSO (niveau 3). À défaut, `BCEG_PARTNER_API_KEY` est utilisé. |
| `FRONTEND_URL` | Base des deep-links et redirection SSO (ex. `https://gaboninsight.com`). |

Authentification de l'API partenaire : header `x-bceg-api-key: <clé>`
(ou `x-bceg-code: <code>`). Aucune session utilisateur requise.

---

## Niveau 1 — Bouton dans l'app BCEG
Ajouter dans l'app BCEG un bouton « Préparer mon dossier » ouvrant Gabon Insight
dans le navigateur. URLs fournies par `GET /api/bceg/partner/deep-link`.

## Niveau 2 — Webview
Charger les mêmes URLs dans une webview intégrée à l'app BCEG.

## Niveau 3 — SSO par jeton signé (disponible)
La BCEG connecte un de ses utilisateurs sur Gabon Insight via un jeton signé
(HMAC-SHA256, secret partagé `BCEG_SSO_SECRET`, à défaut `BCEG_PARTNER_API_KEY`).

**Format du jeton** : `base64url(payload) + "." + base64url(HMAC_SHA256(payload, secret))`
où `payload = { "email": "...", "name": "...", "exp": <unix_seconds> }`.

**Flux** : la BCEG ouvre `GET /api/bceg/sso?token=<jeton>&redirect=<url_app_optionnelle>`.
La plateforme vérifie la signature + l'expiration, crée le compte si besoin,
puis redirige l'utilisateur **déjà connecté** vers l'app (`/business/mes-projets`
par défaut, ou `redirect` s'il pointe vers `FRONTEND_URL`).

**Test (admin)** : `GET /api/bceg/sso/test-token?email=...` renvoie un jeton +
`sso_url` valide 5 min pour vérifier l'intégration.

Exemple de génération de jeton (Node) :
```js
const crypto = require('crypto');
const payload = { email, name, exp: Math.floor(Date.now()/1000) + 300 };
const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const token = `${p}.${sig}`; // → /api/bceg/sso?token=${token}
```
*(OIDC/OAuth2 complet reste possible ultérieurement si la DSI le souhaite.)*

## Niveau 4 — API dossier (disponible)
Le back-office BCEG consomme les dossiers soumis et renvoie ses décisions.

### Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/api/bceg/partner/ping` | Test de clé / santé. |
| GET | `/api/bceg/partner/deep-link` | URLs pour niveaux 1-2. |
| GET | `/api/bceg/partner/submissions` | Liste des dossiers (fiches consolidées). |
| GET | `/api/bceg/partner/submissions/:id` | Dossier complet (projet + simulation + score live). |
| PATCH | `/api/bceg/partner/submissions/:id` | Retour de décision BCEG. |

### Filtres de la liste
`?status=submitted,in_review,accepted` · `?secteur=...` · `?tier=1|2|3`
· `?since=ISO` · `?limit=` (défaut 100, max 500).
Sans `status`, retourne `submitted, in_review, accepted`.

### Fiche consolidée (résumé)
```json
{
  "id": "uuid",
  "reference": "BCEG-...",
  "status": "submitted",
  "titre": "…",
  "secteur": "Agriculture",
  "ville": "Libreville",
  "montant_demande": 4500000,
  "financing_tier": 2,
  "score": 78,
  "risk": { "level": "faible|modere|eleve", "label": "Risque faible", "recommendation": "…" },
  "formation": { "passed": 10, "total": 15, "ok": true },
  "applicant": { "name": "…", "email": "…", "phone": "…", "province": "…" },
  "pdf_url": "https://…",
  "submitted_at": "…", "decision_at": null, "created_at": "…"
}
```
Le détail (`/:id`) ajoute : `score_live` (projet + formation recalculée),
`admin_notes`, `project` (toutes les sections) et `simulation` (crédit).

### Retour de décision
```http
PATCH /api/bceg/partner/submissions/:id
x-bceg-api-key: <clé>
Content-Type: application/json

{ "status": "accepted", "bceg_reference": "BCEG-2026-001", "decision_note": "Accord sous garantie." }
```
`status` ∈ `in_review | accepted | rejected`. La décision notifie
automatiquement le porteur (in-app + WhatsApp + email, best-effort).

### Exemple
```bash
curl -H "x-bceg-api-key: $BCEG_PARTNER_API_KEY" \
  "$API/api/bceg/partner/submissions?status=submitted&tier=2"
```

---

## Notes
- Le **niveau de risque** et la **recommandation** sont des indicateurs d'aide
  à la décision, **pas** une décision de crédit automatique.
- Le **BCEG Score** intègre la formation (60 % projet + 40 % formation).
