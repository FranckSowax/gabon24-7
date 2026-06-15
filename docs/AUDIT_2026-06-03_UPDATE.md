# Audit gabon24-7 — Mise à jour post-remédiation

*Auditeur : Claude Opus 4.8 — Mise à jour du 2026-06-03 (audit initial : 2026-06-03)*
*Métriques DB vérifiées en live sur la prod Supabase au moment de la rédaction.*

---

## Résumé Exécutif — révisé

**Note globale : D+ → B−**

La session de remédiation a fermé **toutes les failles critiques actionnables côté code et base de données**. L'exposition majeure — 53 tables sans RLS, dont `admin_users`, `student_auth_tokens`, des RPC financiers exécutables par n'importe quel porteur de clé anon — est **éliminée**. Les 2 vulnérabilités npm critiques sont supprimées, la diffusion WhatsApp est réparée, l'observabilité (Sentry) et un filet de tests + CI bloquante sont en place, et 18 routes sensibles sont désormais validées par Zod.

**Ce qui empêche un A** : il reste **un risque critique non clôturé qui dépend d'une action humaine** (rotation des clés Supabase + purge de l'historique git), l'absence de protection CSRF, et la dette structurelle de `server.js` (6000+ lignes). Ces points sont documentés et planifiés, mais non traités.

**Risques résiduels (ordre de priorité) :**
1. 🔴 Clés Supabase toujours présentes dans l'historique git (rotation = action propriétaire)
2. 🟠 Pas de protection CSRF sur les endpoints state-changing
3. 🟡 `server.js` god-file (maintenabilité, pas une faille)

---

## Tableau de bord avant / après

| Indicateur | Audit initial | Maintenant | Vérif |
|---|---|---|---|
| Tables `public` sans RLS | **53** | **0** | live |
| ERROR sécurité Supabase | 4 | **0** | live |
| RPC financiers exécutables anon/authenticated | 13 | **0** | live |
| Policies `auth_rls_initplan` (perf) | ~184 | **0** | live |
| Groupes d'index dupliqués | 31 | **0** | live |
| Vulnérabilités npm critiques | 2 | **0** | `npm audit` |
| Version Postgres | 17.4 (patch en attente) | **17.6** | live |
| HIBP (mots de passe leakés) | off | **on** | dashboard |
| Endpoints IA sans rate-limit | 7 | **0** | code |
| Routes sensibles sans validation | ~30 | **~12** | code |
| Secret-scan en CI | absent | **gitleaks (arbre courant)** | CI |
| Monitoring d'erreur | absent | **Sentry câblé** (DSN à fournir) | code |
| Middleware d'erreur centralisé | absent | **présent** | code |
| Tests d'intégration | 0 réels exécutés en CI | **13 verts, CI bloquante** | CI |
| Tracker de migrations SQL | absent | **schema_migrations + runner** | live |
| God-file `server.js` | 6039 lignes | ~6060 (inchangé) | code |
| Fichiers ad-hoc racine `backend/` | 93 | **15** | repo |
| Secrets hardcodés dans le code | 5 fichiers | **0** (mais historique git à purger) | repo |

---

## Détail par dimension (statut actualisé)

### Sécurité — 🔴→🟢 (sauf rotation clés)

**Résolu :**
- ✅ RLS activée sur 100 % des tables `public` (53 corrigées : 4 à policies orphelines, 46 backend-only en service_role, 3 frontend avec policies explicites + admin_notifications).
- ✅ Vue `student_dashboard` (fuite `auth.users.email`) fermée aux rôles publics.
- ✅ 4 vues passées en `security_invoker`.
- ✅ 13 RPC financiers/PII (`consume_credits`, `add_credits`, `process_pvit_callback`, `get_user_by_email`…) : `EXECUTE` révoqué pour anon/authenticated (le backend passe par service_role).
- ✅ 3 secrets hardcodés supprimés (`test-rss-youtube-fix.js`, `server-simple.js`, `import-csv-articles.js`) ; `.env.production`/`.env.temp` retirés du tracking.
- ✅ `requireAdmin` ajouté sur broadcast / system-update / stats.
- ✅ `/health` minimisé ; `/health/detailed` + `/api/deployment-check` derrière token interne ; route debug WhatsApp inline supprimée.
- ✅ HIBP activé. 2 vuln npm critiques supprimées (retrait `node-telegram-bot-api`).
- ✅ 18 routes sensibles validées par Zod.

**Restant :**
- 🔴 **Rotation des clés Supabase + purge git history** — les anciennes clés sont encore dans les commits. Action propriétaire (guide fourni). Tant que non fait, considérer les clés comme compromises.
- 🟠 **CSRF absent** sur les endpoints state-changing.
- 🟡 ~12 routes secondaires encore sans validation Zod (actu-plus, feedback, project-actions, user-contexts, generate-letter, skill-test, training…).
- 🟡 `secret-scan` CI ne couvre que l'arbre courant (`--no-git`) — passera en scan d'historique complet **après** la purge.

### Architecture & Conception — 🔴 (inchangé, planifié)
- 🔴 `server.js` toujours 6000+ lignes, 93 routes inline. **Non traité** — chantier M2-1 (XL), nécessite plus de tests d'abord.
- 🟠 Couplage direct routes ↔ Supabase (pas de couche repository). Non traité.
- ✅ Middleware d'erreur centralisé ajouté (était absent).
- 🟡 3 systèmes de scheduling toujours coexistants (Railway/Netlify/node-cron).

### Qualité du code — 🟡 (amélioré)
- ✅ Legacy supprimé (`_legacy/`, `migration-backup`, `credits-premium.legacy.js`), 78 scripts ad-hoc archivés.
- ✅ Versions inter-workspace alignées (supabase-js, axios, uuid) ; `crypto@1.0.1` retiré.
- 🟡 ~3000 `console.log` vs Winston : non traité (faible levier).
- 🟡 ESLint/Prettier frontend : **non créé** (bloqué par un hook config-protection ; à faire manuellement).

### Tests — 🟠 (amélioré depuis ~0)
- ✅ 13 tests d'intégration (health, error-handler, migrate-runner) + CI bloquante (`test:integration`).
- 🟡 3 scénarios métier documentés mais non implémentés (auth, credits, whatsapp) — voir `tests/integration/TODO-business-flows.md`.
- 🟡 Anciens tests (`auth.test.js`, `credit-manager-premium.test.js`) toujours rouges, hors du gate CI.

### Performance — 🟢 (nettement amélioré)
- ✅ 33 index dupliqués supprimés.
- ✅ ~180 policies RLS optimisées (`auth.uid()` → `(select auth.uid())`).
- ✅ Indexes hot confirmés présents (articles.published_at, reading_history) via EXPLAIN.
- 🟡 N+1 dans `routes/game.js` : non traité (perf, pas critique).
- 🟡 58 FK non indexées + 337 index inutilisés : à traiter au cas par cas (pas en masse).

### Observabilité & Ops — 🟢 (résolu)
- ✅ Sentry câblé back + front (no-op tant que DSN absent → à fournir en env).
- ✅ Tracker de migrations versionné + runner idempotent.
- ✅ Postgres patché 17.6.
- 🟡 Schedulers Netlify/Railway toujours non consolidés.

### Dépendances — 🟢 (résolu)
- ✅ `crypto@1.0.1`, `node-telegram-bot-api`, three.js (déjà absent) nettoyés ; lockfiles resync.

### Correction fonctionnelle
- ✅ **Bug d'origine résolu** : la diffusion WhatsApp ne se bloque plus sur un quota OpenAI 429 (fallback Gemini via `geminiService.generateJSON`).

---

## Plan restant (révisé)

### 🔴 Action propriétaire (hors-code) — priorité absolue
1. **Rotation clés Supabase + purge git history** (guide fourni). Zéro downtime.
2. Env vars : `SENTRY_DSN` (Railway), `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` (Netlify), `INTERNAL_HEALTH_TOKEN` (Railway).
3. Après purge → activer scan gitleaks sur historique complet.

### 🟠 Chantiers code (sur go)
4. CSRF (M1-3) — middleware + adaptation frontend.
5. Finir la validation Zod (~12 routes restantes).
6. Extraire les 93 routes inline de `server.js` (M2-1, XL, par lots).

### 🟡 Qualité & perf (Jalon 3)
7. RPC `increment_ticker_click` (dette du durcissement RLS ticker).
8. ESLint/Prettier frontend (hook à débloquer).
9. FK manquantes / index inutilisés (analyse cas par cas).
10. Consolidation des schedulers ; découpe `routes/game.js` ; migration des erreurs vers Winston.
11. DROP définitif de `student_dashboard` (après 30j d'observation).

---

## Migrations appliquées cette session (trace)

| Version | Objet |
|---|---|
| `create_schema_migrations_tracker` | Table de tracking |
| `m1_1bis_*` (A/B/C/D) | RLS orphelines, student_dashboard, security_invoker, REVOKE RPC |
| `m1ter_a_enable_rls_backend_only_46` | RLS sur 46 tables backend-only |
| `m1ter_b_frontend_facing_policies` | Policies ticker/banners/admin_notifications |
| `20260603_m3_drop_duplicate_indexes` (+ rss followup) | 33 index dupliqués |
| `20260603_m3_wrap_auth_rls_initplan` | ~180 policies optimisées |

Commits associés : `207b0d8`, `8305038`, `7639aa9`, `b294fb5`, `3a4d4d0`.

---

## Questions ouvertes (inchangées)
1. Le dépôt GitHub est-il public ou privé ? (détermine l'urgence absolue de la rotation)
2. `whatsapp-web.js` et `bullmq` sont-ils encore utilisés ? (candidats à la suppression)
3. Trafic réel (req/min, DAU) → priorise ou non le N+1 game.js et les FK non indexées.
4. Conformité RGPD / loi gabonaise sur les données ? (ajouterait un volet absent du plan)
