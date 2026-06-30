# Intégration BCEG ↔ Gabon Insight

Ce document décrit l'intégration progressive (niveaux 1→4 du rapport) entre
l'application/back-office BCEG et Gabon Insight.

## Configuration (variables d'environnement Railway)

| Variable | Rôle |
|---|---|
| `BCEG_PARTNER_API_KEY` | Clé API machine-to-machine pour le back-office BCEG (niveau 4). **À générer et partager de façon sécurisée.** |
| `BCEG_PORTAL_CODE` | Code portail existant (alternative à la clé). |
| `FRONTEND_URL` | Base des deep-links (ex. `https://gaboninsight.com`). |

Authentification de l'API partenaire : header `x-bceg-api-key: <clé>`
(ou `x-bceg-code: <code>`). Aucune session utilisateur requise.

---

## Niveau 1 — Bouton dans l'app BCEG
Ajouter dans l'app BCEG un bouton « Préparer mon dossier » ouvrant Gabon Insight
dans le navigateur. URLs fournies par `GET /api/bceg/partner/deep-link`.

## Niveau 2 — Webview
Charger les mêmes URLs dans une webview intégrée à l'app BCEG.

## Niveau 3 — SSO (à cadrer avec la DSI)
Échange de jeton entre comptes BCEG et Gabon Insight. Non implémenté côté
plateforme : nécessite un accord sur le protocole (OIDC/OAuth2 ou jeton signé
partagé). La base machine-to-machine (niveau 4) est déjà disponible.

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
