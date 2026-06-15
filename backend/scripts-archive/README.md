# scripts-archive

Anciens scripts ad-hoc de diagnostic, fixes ponctuels, et tests manuels qui étaient à la racine de `backend/`. Déplacés ici le 2026-06-03 pour assainir l'arborescence (cf. plan d'audit, QW-10).

Ces scripts ne sont **pas appelés** par `server.js`, les routes, les services, ni les schedulers ; ils ont servi à des tâches one-shot historiques.

Avant de supprimer un fichier de ce dossier :
1. `grep -r "<nom>" .. --include="*.js"` pour confirmer qu'il n'est référencé nulle part en runtime.
2. Vérifier qu'aucun cron Railway/Netlify ne l'invoque.
3. Vérifier qu'il n'est pas listé dans `package.json` scripts (ex. `rss:once`, `rss:status`).

Catégories présentes :
- `check-*` : diagnostics d'état (articles, feeds, RSS, audio).
- `fix-*` : correctifs ponctuels sur la base (images, sources, catégories).
- `enrich-*` : ré-enrichissement manuel d'articles avec l'IA.
- `test-*` : essais manuels de fonctionnalités (audio, RSS, OpenAI).
- `create-*` : créations one-shot de tables/données de test.
- `generate-*` : générations manuelles d'audios quotidiens.
- `run-*-migration` : exécutions manuelles de migrations SQL.
- `sync-*`, `force-*`, `requalify-*`, `rescan-*`, `reimage-*` : tâches de maintenance.
- `migration-credits.js`, `add_routes.js`, `apply-migration-simple.js`, `activate-all-feeds.js`, `cleanup-duplicates.js`, `fetch-events.js`, `quick-rss-sync.js`, `setup-audio-storage.js` : utilitaires divers.

Note : 3 fichiers contenant des secrets Supabase en clair (`test-rss-youtube-fix.js`, `server-simple.js`, `import-csv-articles.js`) ont été **supprimés** lors du même nettoyage, pas archivés. Les clés concernées doivent être rotated (cf. tâche M1-1 du plan d'audit).
