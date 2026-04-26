# 🔄 PLAN D'UNIFICATION BACKEND

## ✅ STATUT: TERMINÉ (28 Décembre 2025)

## Objectif
Unifier le backend sur Railway et garder uniquement les scheduled functions sur Netlify.

---

## 📊 ANALYSE DES FONCTIONS NETLIFY (87 fonctions)

### ✅ SCHEDULED FUNCTIONS À CONSERVER (10 fonctions)
Ces fonctions utilisent le cron de Netlify et doivent rester :

| Fonction | Schedule | Description |
|----------|----------|-------------|
| `scheduled-rss-sync.js` | */15 * * * * | Sync RSS toutes les 15 min |
| `scheduled-ai-processor.js` | */3 * * * * | Traitement IA toutes les 3 min |
| `process-ticker-news.js` | 0 */3 * * * | Messages ticker toutes les 3h |
| `scheduled-alert-processor.js` | */5 * * * * | Alertes toutes les 5 min |
| `scheduled-digest-notifications.js` | 0 8 * * * | Digest quotidien 8h UTC |
| `generate-daily-poll.js` | 0 18 * * * | Sondage quotidien 18h UTC |
| `scheduled-poll-closer.js` | 55 18 * * * | Clôture sondages 18h55 UTC |
| `scheduled-poll-publisher.js` | 0 19 * * * | Publication sondages 19h UTC |
| `scheduled-audio-daily.js` | 0 6 * * * | Audio quotidien 6h UTC |
| `scheduled-audio-cleanup.js` | 0 * * * * | Nettoyage audio toutes les heures |

---

### ❌ FONCTIONS DUPLIQUÉES À ARCHIVER (77 fonctions)

#### Crédits (5 fonctions) → Backend: `routes/credits.js`, `routes/credits-premium.js`
- `credit-manager.js`
- `credit-packages.js`
- `credit-stats.js`
- `credit-test-simple.js`

#### Campagnes (2 fonctions) → Backend: `routes/campaigns.js`, `routes/admin-campaigns.js`
- `campaigns.js`
- `admin-campaigns.js`

#### Audio (2 fonctions) → Backend: `routes/audio.js`
- `audio-settings.js`
- `audio-summary.js`

#### Admin (5 fonctions) → Backend: `routes/admin.js`, `routes/admin-*.js`
- `admin-analytics.js`
- `admin-clients.js`
- `admin-dashboard.js`
- `admin-routes.js`
- `admin-slides.js`

#### Articles/Actu (4 fonctions) → Backend: `routes/actu-plus.js`, `server.js`
- `actu-plus.js`
- `supabase-articles.js`
- `article-view.js`
- `delete-articles.js`

#### Sondages (6 fonctions) → Backend: `routes/polls.js`
- `check-user-votes.js`
- `create-current-poll.js`
- `create-manual-poll.js`
- `create-manual-series-poll.js`
- `get-poll-questions.js`
- `get-question-stats.js`
- `poll-responses.js`
- `poll-stats.js`
- `vote-question.js`

#### Opportunités/Business (7 fonctions) → Backend: `routes/opportunities.js`
- `analyze-opportunity.js`
- `analyze-opportunity-complex.js`
- `enhance-opportunity.js`
- `generate-business-ideas.js`
- `generate-opportunities-by-budget.js`
- `generate-project-proposals.js`
- `generate-project-proposals-complex.js`

#### Projets (4 fonctions) → Backend: `routes/saved-projects.js`, `routes/projects.js`
- `get-saved-projects.js`
- `save-project.js`
- `personalize-proposal.js`
- `get-saved-docs.js`
- `save-doc.js`

#### Routes/Maps (4 fonctions) → Backend: `routes/admin-routes.js` (dans server.js)
- `create-route.js`
- `delete-route.js`
- `get-routes.js`
- `update-route.js`

#### Images (6 fonctions) → Backend: `routes/image-proxy.js`, `routes/uploads.js`
- `image-proxy.js`
- `extract-missing-images.js`
- `extract-recent-images.js`
- `retroactive-image-extraction.js`
- `scrape-article-images.js`
- `scrape-bulk-images.js`
- `upload-image.js`

#### RSS (5 fonctions) → Backend: `rss-processor.js`, `rss-aggregator.js`
- `rss-sync.js`
- `rss-sync-bundle.js`
- `rss-bundle-fast.js`
- `rss-bundle-mcp-enhanced.js`
- `manual-rss-sync.js`

#### IA/Enrichissement (4 fonctions) → Backend: `services/article-ai-enrichment.js`
- `ai-enrich-articles.js`
- `ai-summary-processor.js`
- `enhanced-source-extractor.js`
- `generate-contextual-poll.js`

#### Événements (3 fonctions) → Backend: `routes/events.js`
- `create-events.js`
- `fetch-events-rss.js`
- `force-resync-events.js`
- `manual-sync-eventime.js`

#### Favoris/Historique (3 fonctions) → Backend: `server.js` (routes favorites)
- `favorites.js`
- `get-user-history.js`
- `track-views.js`

#### Divers (10 fonctions)
- `ad-packages.js` → Backend: à créer ou dans campaigns
- `auth-status.js` → Backend: middleware auth
- `check-updates.js` → Backend: health check
- `import-csv-articles.js` → Backend: admin
- `process-alert-matches.js` → Backend: routes/alerts.js
- `send-urgent-message.js` → Backend: routes/whatsapp.js
- `sync-logs.js` → Backend: admin
- `test-articles-structure.js` → Supprimer (test)
- `update-ticker-message.js` → Backend: server.js
- `upload-csv-gbi.js` → Backend: admin
- `youtube-feed.js` → Backend: server.js

---

## 🚀 ACTIONS À EFFECTUER

### Étape 1: Créer le dossier d'archive
```bash
mkdir -p netlify/functions/_archived
```

### Étape 2: Déplacer les fonctions dupliquées
Toutes les fonctions non-scheduled seront déplacées vers `_archived/`

### Étape 3: Mettre à jour netlify.toml
Garder uniquement les configurations des scheduled functions

### Étape 4: Vérifier les appels frontend
S'assurer que le frontend utilise `NEXT_PUBLIC_API_URL` (Railway) et non `/.netlify/functions/`

---

## ⚠️ RISQUES

1. **Fonctions appelées directement par le frontend** : Certaines fonctions Netlify peuvent être appelées via `/.netlify/functions/nom-fonction`. Il faut vérifier et rediriger vers Railway.

2. **Scheduled functions qui appellent d'autres fonctions** : Les scheduled functions peuvent dépendre de fonctions qu'on archive.

---

*Plan généré le 28 Décembre 2025*
