#!/usr/bin/env node
/**
 * 📤 INSIGHT-REPLY.JS
 * Envoyer une réponse d'Insight vers Telegram via le bridge
 *
 * Usage: node insight-reply.js "Votre message ici"
 */

const fs = require('fs');

const REPLIES_FILE = '/tmp/insight_replies.json';

const text = process.argv.slice(2).join(' ');

if (!text) {
  console.error('❌ Usage: node insight-reply.js "Votre message"');
  process.exit(1);
}

let replies = [];
try {
  replies = JSON.parse(fs.readFileSync(REPLIES_FILE, 'utf8'));
} catch { replies = []; }

replies.push({
  text,
  date: new Date().toISOString(),
});

fs.writeFileSync(REPLIES_FILE, JSON.stringify(replies, null, 2));
console.log(`✅ Réponse envoyée: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
