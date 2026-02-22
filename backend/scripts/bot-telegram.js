#!/usr/bin/env node
/**
 * 🤖 BOT-TELEGRAM.JS
 * Bot Telegram unifié : Monitoring + Bridge Insight
 *
 * Commandes:
 *   /start    - Message de bienvenue
 *   /health   - Vérifier la santé de l'API
 *   /stats    - Statistiques admin (articles, users)
 *   /ai       - Statut quota IA
 *   /credits  - Packages de crédits disponibles
 *   /monitor  - Rapport complet
 *   /help     - Liste des commandes
 *
 * Messages texte (sans /) → stockés dans /tmp/insight_messages.json
 * Réponses Insight → lues depuis /tmp/insight_replies.json
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

// =====================================================
// CONFIGURATION
// =====================================================
const BOT_TOKEN = process.env.NOTIF_BOT_TOKEN;
const API_URL = process.env.GABON247_API_URL || 'https://gabon24-7-production.up.railway.app';
const ADMIN_TOKEN = process.env.GABON247_ADMIN_TOKEN;
const ALLOWED_CHAT_ID = process.env.NOTIF_CHAT_ID || '1903781052';
const MESSAGES_FILE = '/tmp/insight_messages.json';
const REPLIES_FILE = '/tmp/insight_replies.json';

if (!BOT_TOKEN) {
  console.error('❌ NOTIF_BOT_TOKEN non défini');
  console.log('Usage: NOTIF_BOT_TOKEN=xxx node bot-telegram.js');
  process.exit(1);
}

// Initialiser les fichiers bridge
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');
if (!fs.existsSync(REPLIES_FILE)) fs.writeFileSync(REPLIES_FILE, '[]');

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =====================================================
// HELPERS
// =====================================================
function isAuthorized(msg) {
  return String(msg.chat.id) === String(ALLOWED_CHAT_ID);
}

function unauthorized(msg) {
  bot.sendMessage(msg.chat.id, `⛔ Non autorisé. Votre chat ID: ${msg.chat.id}`);
}

function timestamp() {
  return new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Libreville' });
}

// =====================================================
// COMMANDES MONITORING
// =====================================================

// /start
bot.onText(/\/start/, (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg);
  bot.sendMessage(msg.chat.id, [
    '🇬🇦 *Gabon 24/7 - Bot Unifié*',
    '',
    '📊 *Monitoring*',
    '  /health  - Santé API',
    '  /stats   - Statistiques',
    '  /ai      - Quota IA',
    '  /credits - Packages crédits',
    '  /monitor - Rapport complet',
    '',
    '💬 *Bridge Insight*',
    '  Envoyez un message texte (sans /) pour communiquer avec Insight.',
    '',
    '  /help - Aide',
  ].join('\n'), { parse_mode: 'Markdown' });
});

// /help
bot.onText(/\/help/, (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg);
  bot.sendMessage(msg.chat.id, [
    '📖 *Commandes*',
    '',
    '🟢 `/health` - Vérifier santé API',
    '📊 `/stats` - Stats admin (articles, users)',
    '🤖 `/ai` - Statut quota IA',
    '💎 `/credits` - Packages crédits',
    '📋 `/monitor` - Rapport complet',
    '',
    '💬 Message texte → transmis à Insight',
  ].join('\n'), { parse_mode: 'Markdown' });
});

// /health
bot.onText(/\/health/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg);

  try {
    const start = Date.now();
    const { data } = await axios.get(`${API_URL}/health`, { timeout: 10000 });
    const latency = Date.now() - start;

    const status = data.status === 'ok' || data.data?.status === 'healthy' ? '🟢' : '🔴';
    bot.sendMessage(msg.chat.id, [
      `${status} *Santé API*`,
      '',
      `Statut: ${data.status || data.data?.status || 'inconnu'}`,
      `Latence: ${latency}ms`,
      `URL: ${API_URL}`,
    ].join('\n'), { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(msg.chat.id, `🔴 *API inaccessible*\n\nErreur: ${error.message}`, { parse_mode: 'Markdown' });
  }
});

// /stats
bot.onText(/\/stats/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg);

  if (!ADMIN_TOKEN) {
    return bot.sendMessage(msg.chat.id, '⚠️ GABON247\\_ADMIN\\_TOKEN non défini');
  }

  try {
    const { data } = await axios.get(`${API_URL}/api/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
      timeout: 10000,
    });

    const stats = data.data || data;
    bot.sendMessage(msg.chat.id, [
      '📊 *Statistiques Gabon 24/7*',
      '',
      `📰 Articles: ${stats.totalArticles || stats.articles_count || 'N/A'}`,
      `👥 Utilisateurs: ${stats.totalUsers || stats.users_count || 'N/A'}`,
      `📅 Articles aujourd'hui: ${stats.todayArticles || stats.today_articles || 'N/A'}`,
      `💰 Revenus: ${stats.totalRevenue || 'N/A'} XAF`,
    ].join('\n'), { parse_mode: 'Markdown' });
  } catch (error) {
    const code = error.response?.status || '';
    bot.sendMessage(msg.chat.id, `❌ Erreur stats ${code}\n${error.message}`, { parse_mode: 'Markdown' });
  }
});

// /ai
bot.onText(/\/ai/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg);

  if (!ADMIN_TOKEN) {
    return bot.sendMessage(msg.chat.id, '⚠️ GABON247\\_ADMIN\\_TOKEN non défini');
  }

  try {
    const { data } = await axios.get(`${API_URL}/api/ai/admin/status`, {
      headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
      timeout: 10000,
    });

    const quota = data.quota || data;
    const pct = quota.percentageUsed || 0;
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

    bot.sendMessage(msg.chat.id, [
      '🤖 *Quota IA*',
      '',
      `[${bar}] ${pct}%`,
      '',
      `Budget restant: ${quota.remainingBudget || 'N/A'}`,
      `Requêtes aujourd'hui: ${quota.todayRequests || 'N/A'}`,
    ].join('\n'), { parse_mode: 'Markdown' });
  } catch (error) {
    const code = error.response?.status || '';
    bot.sendMessage(msg.chat.id, `❌ Erreur AI status ${code}\n${error.message}`, { parse_mode: 'Markdown' });
  }
});

// /credits
bot.onText(/\/credits/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg);

  try {
    const { data } = await axios.get(`${API_URL}/api/credits/packages`, { timeout: 10000 });
    const packages = data.packages || data.data || data;

    if (!Array.isArray(packages) || packages.length === 0) {
      return bot.sendMessage(msg.chat.id, '💎 Aucun package trouvé');
    }

    const lines = packages.map((p) =>
      `• *${p.name}* — ${p.price} XAF (${p.credits} crédits${p.bonus ? ` +${p.bonus} bonus` : ''})`
    );

    bot.sendMessage(msg.chat.id, ['💎 *Packages Crédits*', '', ...lines].join('\n'), { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(msg.chat.id, `❌ Erreur crédits\n${error.message}`);
  }
});

// /monitor - Rapport complet
bot.onText(/\/monitor/, async (msg) => {
  if (!isAuthorized(msg)) return unauthorized(msg);

  bot.sendMessage(msg.chat.id, '⏳ Génération du rapport...');

  const results = [];

  // Health
  try {
    const start = Date.now();
    const { data } = await axios.get(`${API_URL}/health`, { timeout: 10000 });
    const latency = Date.now() - start;
    const ok = data.status === 'ok' || data.data?.status === 'healthy';
    results.push(`${ok ? '🟢' : '🔴'} API: ${ok ? 'OK' : 'ERROR'} (${latency}ms)`);
  } catch {
    results.push('🔴 API: INACCESSIBLE');
  }

  // Stats
  if (ADMIN_TOKEN) {
    try {
      const { data } = await axios.get(`${API_URL}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
        timeout: 10000,
      });
      const s = data.data || data;
      results.push(`📰 Articles: ${s.totalArticles || s.articles_count || 'N/A'}`);
      results.push(`👥 Users: ${s.totalUsers || s.users_count || 'N/A'}`);
    } catch {
      results.push('❌ Stats: erreur');
    }

    // AI
    try {
      const { data } = await axios.get(`${API_URL}/api/ai/admin/status`, {
        headers: { 'Authorization': `Bearer ${ADMIN_TOKEN}` },
        timeout: 10000,
      });
      const pct = data.quota?.percentageUsed || 0;
      results.push(`🤖 IA: ${pct}% utilisé`);
    } catch {
      results.push('❌ IA: erreur');
    }
  } else {
    results.push('⚠️ Token admin non défini (stats/IA ignorés)');
  }

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' });

  bot.sendMessage(msg.chat.id, [
    '📋 *Rapport Monitoring*',
    `🕐 ${now}`,
    '',
    ...results,
  ].join('\n'), { parse_mode: 'Markdown' });
});

// =====================================================
// BRIDGE INSIGHT (messages texte sans commande)
// =====================================================

bot.on('message', (msg) => {
  // Ignorer les non-autorisés
  if (!isAuthorized(msg)) return;
  // Ignorer les commandes (déjà gérées ci-dessus)
  if (msg.text && msg.text.startsWith('/')) return;
  // Ignorer les messages sans texte
  if (!msg.text) return;

  const message = {
    id: msg.message_id,
    from: msg.from?.first_name || 'Utilisateur',
    text: msg.text,
    date: new Date(msg.date * 1000).toISOString(),
    read: false,
  };

  // Stocker le message
  let messages = [];
  try {
    messages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch { messages = []; }

  messages.push(message);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

  console.log(`📨 [${timestamp()}] ${message.from}: ${message.text}`);
  bot.sendMessage(msg.chat.id, '✅ Message transmis à Insight');
});

// Surveiller les réponses d'Insight → envoyer sur Telegram
let lastReplyCount = 0;
try {
  lastReplyCount = JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8')).length;
} catch { lastReplyCount = 0; }

setInterval(() => {
  try {
    const replies = JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8'));

    if (replies.length > lastReplyCount) {
      const newReplies = replies.slice(lastReplyCount);
      for (const reply of newReplies) {
        bot.sendMessage(ALLOWED_CHAT_ID, reply.text, { parse_mode: 'Markdown' });
        console.log(`📤 [${timestamp()}] Insight → Telegram: ${reply.text.substring(0, 50)}...`);
      }
      lastReplyCount = replies.length;
    }
  } catch {
    // Fichier invalide, on skip
  }
}, 2000);

// =====================================================
// DÉMARRAGE
// =====================================================
console.log('🤖 Bot Telegram Gabon 24/7 démarré (Monitoring + Bridge)');
console.log(`📨 Messages bridge: ${MESSAGES_FILE}`);
console.log(`📤 Réponses bridge: ${REPLIES_FILE}`);
console.log('✅ Commandes: /start /health /stats /ai /credits /monitor /help');
console.log('💬 Messages texte → bridge Insight');
