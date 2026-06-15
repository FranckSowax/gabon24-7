#!/usr/bin/env node
/**
 * Runner de migrations SQL versionné — idempotent.
 *
 * Lit `backend/migrations/*.sql` triés par nom de fichier, applique chacune
 * dont le `version` (nom sans .sql) n'est pas déjà dans `schema_migrations`,
 * enregistre la trace (version, applied_at, checksum sha256 du contenu).
 *
 * Pré-requis :
 *   - Variables d'environnement : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - La table `schema_migrations` doit exister
 *     (créée par migrations/000_create_schema_migrations.sql — à appliquer 1× manuellement
 *      dans le SQL Editor Supabase, puis ce runner prend le relais).
 *   - Une fonction Postgres `exec_sql(sql text)` côté Supabase, ou bien on passe
 *     par psql directement. Par défaut on utilise psql via DATABASE_URL si présent.
 *
 * Usage :
 *   DATABASE_URL=postgres://... node scripts/migrate.js              # applique les nouvelles
 *   DATABASE_URL=postgres://... node scripts/migrate.js --dry-run    # liste ce qui serait appliqué
 *   DATABASE_URL=postgres://... node scripts/migrate.js --status     # liste applied vs pending
 *
 * Note : on évite délibérément le client Supabase JS ici car il ne permet pas
 * d'exécuter des blocs SQL multi-statements de façon transactionnelle.
 * On utilise `pg` (déjà transitivement présent via Supabase).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const DRY_RUN = process.argv.includes('--dry-run');
const STATUS_ONLY = process.argv.includes('--status');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function readMigration(file) {
  const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  return { version: file.replace(/\.sql$/, ''), file, content, checksum: sha256(content) };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL manquant. Fournir la connection string Postgres Supabase.');
    console.error('   Exemple : DATABASE_URL=postgres://postgres:[PWD]@db.[REF].supabase.co:5432/postgres');
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch (err) {
    console.error('❌ Le module `pg` est requis. Ajouter : npm install pg --save');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Vérifier que schema_migrations existe
    const { rows: tableCheck } = await client.query(
      `SELECT to_regclass('public.schema_migrations') AS tbl`
    );
    if (!tableCheck[0].tbl) {
      console.error(
        '❌ Table `schema_migrations` introuvable. Appliquer d\'abord :\n   migrations/000_create_schema_migrations.sql'
      );
      process.exit(2);
    }

    const { rows: appliedRows } = await client.query(
      `SELECT version, checksum FROM schema_migrations`
    );
    const applied = new Map(appliedRows.map((r) => [r.version, r.checksum]));

    const files = listMigrationFiles();
    const pending = [];
    const drifted = [];

    for (const file of files) {
      const m = readMigration(file);
      if (!applied.has(m.version)) {
        pending.push(m);
      } else if (applied.get(m.version) !== m.checksum) {
        drifted.push(m);
      }
    }

    console.log(`📊 Migrations : ${files.length} total, ${applied.size} appliquées, ${pending.length} en attente, ${drifted.length} divergentes.`);

    if (drifted.length > 0) {
      console.warn('⚠️  Divergences de checksum (le fichier a été modifié après application) :');
      drifted.forEach((m) => console.warn(`   - ${m.version}`));
    }

    if (STATUS_ONLY) {
      console.log('\nAppliquées :');
      appliedRows.forEach((r) => console.log(`  ✅ ${r.version}`));
      console.log('\nEn attente :');
      pending.forEach((m) => console.log(`  ⏳ ${m.version}`));
      return;
    }

    if (pending.length === 0) {
      console.log('✅ Aucune migration à appliquer.');
      return;
    }

    if (DRY_RUN) {
      console.log('\nMode --dry-run, migrations qui seraient appliquées :');
      pending.forEach((m) => console.log(`  ⏳ ${m.version}`));
      return;
    }

    const appliedBy = process.env.USER || process.env.USERNAME || 'unknown';

    for (const m of pending) {
      console.log(`▶️  Application : ${m.version}`);
      await client.query('BEGIN');
      try {
        await client.query(m.content);
        await client.query(
          `INSERT INTO schema_migrations (version, checksum, applied_by) VALUES ($1, $2, $3)`,
          [m.version, m.checksum, appliedBy]
        );
        await client.query('COMMIT');
        console.log(`   ✅ ${m.version} appliquée`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ❌ ${m.version} a échoué : ${err.message}`);
        process.exit(3);
      }
    }

    console.log(`\n✅ ${pending.length} migration(s) appliquée(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err);
  process.exit(99);
});
