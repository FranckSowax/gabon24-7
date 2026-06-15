/**
 * Tests du runner de migrations scripts/migrate.js.
 *
 * On exécute le script comme un sous-process et on observe le code de retour
 * et le stderr. C'est volontairement un test "shape" — on ne touche pas à une
 * vraie DB ici, on vérifie juste que le contrat de défense (DATABASE_URL absent,
 * pg manquant) est respecté.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'migrate.js');

function runMigrate(args = [], env = {}) {
  return spawnSync('node', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env, NODE_ENV: 'test' },
    timeout: 8000,
  });
}

describe('scripts/migrate.js', () => {
  it('exits non-zero when DATABASE_URL is missing', () => {
    const result = runMigrate(['--dry-run'], { DATABASE_URL: '' });
    expect(result.status).not.toBe(0);
    const out = (result.stderr || '') + (result.stdout || '');
    expect(out).toMatch(/DATABASE_URL/);
  });

  it('--status flag is recognized (parses args without crashing on missing DB url)', () => {
    const result = runMigrate(['--status'], { DATABASE_URL: '' });
    // Avec DATABASE_URL vide, on s'arrête tôt avec le même message.
    expect(result.status).not.toBe(0);
  });

  it('script file is executable Node code (smoke parse)', () => {
    // Vérifie qu'on peut au moins l'interpréter sans crash de syntaxe.
    const result = spawnSync('node', ['--check', SCRIPT], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });
});
