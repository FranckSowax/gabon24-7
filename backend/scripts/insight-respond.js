#!/usr/bin/env node
/**
 * INSIGHT-RESPOND.JS
 * Envoyer une reponse a un message Telegram via le webhook bot-webhook.js
 *
 * Usage: node insight-respond.js "messageId" "Ta reponse ici"
 */

const axios = require('axios');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3456/webhook/insight';

const messageId = process.argv[2];
const response = process.argv.slice(3).join(' ');

if (!messageId || !response) {
  console.error('Usage: node insight-respond.js "messageId" "Ta reponse"');
  process.exit(1);
}

axios.post(WEBHOOK_URL, {
  messageId: messageId,
  response: response
}).then(() => {
  console.log('Reponse envoyee');
}).catch(err => {
  console.error('Erreur:', err.message);
});
