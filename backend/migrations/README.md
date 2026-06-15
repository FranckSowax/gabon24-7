# Migrations SQL

## Workflow versionné

Depuis 2026-06-03, les migrations sont appliquées via [`scripts/migrate.js`](../scripts/migrate.js), qui :
1. Lit `migrations/*.sql` triés par nom de fichier.
2. Skip celles déjà enregistrées dans la table `schema_migrations`.
3. Applique chaque nouvelle migration dans une **transaction** (rollback automatique si erreur).
4. Enregistre `(version, applied_at, checksum sha256, applied_by)`.

## Démarrage initial (à faire 1 fois)

1. **Créer la table de tracking** :
   - Ouvrir le SQL Editor Supabase.
   - Coller le contenu de [`000_create_schema_migrations.sql`](000_create_schema_migrations.sql) et exécuter.

2. **Back-filler l'historique** : marquer toutes les migrations déjà appliquées comme `applied` pour ne pas les rejouer. Dans le SQL Editor :
   ```sql
   INSERT INTO schema_migrations (version, checksum, applied_by)
   SELECT
     replace(name, '.sql', ''),
     '<backfill>',
     'backfill'
   FROM unnest(ARRAY[
     -- Coller ici la liste des fichiers .sql existants au moment du back-fill.
     -- Générer avec : ls backend/migrations/*.sql | xargs -n1 basename
     '20251203_fix_polls_schema.sql',
     '20251230_cleanup_netlify_proxy_urls.sql'
     -- ... etc
   ]) AS name
   ON CONFLICT (version) DO NOTHING;
   ```

3. **Vérifier l'état** :
   ```bash
   DATABASE_URL=postgres://postgres:[PWD]@db.[REF].supabase.co:5432/postgres \
     node scripts/migrate.js --status
   ```

## Quotidien

```bash
# Dry-run : voir ce qui serait appliqué
DATABASE_URL=... node scripts/migrate.js --dry-run

# Appliquer
DATABASE_URL=... node scripts/migrate.js
```

## Règles

- **Une migration = un fichier `.sql`** avec un nom préfixé par un timestamp ou un numéro (`20260603_add_xxx.sql`).
- **Idempotence recommandée** (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … IF NOT EXISTS`) — c'est un filet de sécurité, mais le tracker garantit déjà qu'une migration ne sera pas rejouée.
- **Ne jamais modifier une migration appliquée** : `--status` détectera la divergence de checksum et avertira. Pour corriger, créer une nouvelle migration qui ajuste.
- Pour appliquer en CI/CD, fournir `DATABASE_URL` comme secret GitHub Actions / Railway.

## Pré-requis Node

```bash
cd backend
npm install pg  # déjà transitif via supabase-js, mais le runner l'utilise directement
```
