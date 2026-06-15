/**
 * Smoke test "server boots".
 *
 * But : attraper les erreurs de démarrage (MODULE_NOT_FOUND, ReferenceError,
 * SyntaxError, throw synchrone) AVANT le déploiement. C'est la classe de bug
 * qui a mis la prod down le 2026-06-15 (un fichier requis avait été archivé
 * par mégarde → routes/events.js → MODULE_NOT_FOUND → crash au boot Railway).
 *
 * Deux niveaux :
 *  1) Chargement de tous les modules routes/ dans un sous-process (déterministe,
 *     sans réseau) — c'est ce qui aurait directement attrapé le crash.
 *  2) Boot réel de server.js : on lance le process et on attend le log
 *     "🚀 Serveur ... démarré sur le port". S'il crashe avant → échec.
 */

const { spawnSync, spawn } = require('child_process');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..', '..');

const TEST_ENV = {
  NODE_ENV: 'test',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-key',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-key',
};

describe('Server boot smoke test', () => {
  it('loads every module in routes/ without error', () => {
    const script = `
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(process.cwd(), 'routes');
      let failed = 0;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
        try { require(path.join(dir, f)); }
        catch (e) { failed++; console.error('LOAD_FAIL routes/' + f + ' :: ' + e.message); }
      }
      process.exit(failed > 0 ? 1 : 0);
    `;
    const res = spawnSync('node', ['-e', script], {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
      env: { ...process.env, ...TEST_ENV },
      timeout: 60000,
    });
    if (res.status !== 0) {
      throw new Error('Chargement routes/ échoué :\n' + (res.stderr || '') + (res.stdout || ''));
    }
    expect(res.status).toBe(0);
  });

  it('boots server.js until it listens (no crash at startup)', async () => {
    const READY = 'démarré sur le port';
    const result = await new Promise((resolve) => {
      const child = spawn('node', ['server.js'], {
        cwd: BACKEND_DIR,
        env: { ...process.env, ...TEST_ENV, PORT: '39517' },
      });

      let output = '';
      let settled = false;
      const finish = (verdict) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { child.kill('SIGKILL'); } catch (_) {}
        resolve(verdict);
      };

      const onData = (d) => {
        output += d.toString();
        if (output.includes(READY)) finish({ ok: true });
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);

      // Crash avant d'écouter → exit prématuré
      child.on('exit', (code) => finish({ ok: false, reason: `exit ${code} avant listen`, output }));
      child.on('error', (err) => finish({ ok: false, reason: err.message, output }));

      // Filet : si pas "ready" en 25s, on considère que ça n'a pas booté
      const timer = setTimeout(() => finish({ ok: false, reason: 'timeout 25s sans listen', output }), 25000);
    });

    if (!result.ok) {
      throw new Error(`server.js n'a pas booté (${result.reason}) :\n` + (result.output || '').slice(-2000));
    }
    expect(result.ok).toBe(true);
  }, 30000);
});
