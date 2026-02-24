#!/usr/bin/env node
/**
 * BOT-WEBHOOK.JS
 * Bot Telegram avec webhook HTTP pour recevoir/repondre aux messages
 *
 * Usage:
 *   NOTIF_BOT_TOKEN=xxx node bot-webhook.js
 *
 * Messages Telegram -> console + queue
 * Reponses via: node insight-respond.js "messageId" "Ta reponse"
 * Ou via POST http://localhost:3456/webhook/insight
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

const CONFIG = {
  botToken: process.env.NOTIF_BOT_TOKEN,
  chatId: process.env.NOTIF_CHAT_ID || '1903781052',
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '3456', 10),
  webhookPath: '/webhook/insight'
};

if (!CONFIG.botToken) {
  console.error('NOTIF_BOT_TOKEN non defini');
  console.log('Usage: NOTIF_BOT_TOKEN=xxx node bot-webhook.js');
  process.exit(1);
}

const messageQueue = [];
const bot = new TelegramBot(CONFIG.botToken, { polling: true });

console.log('Bot Webhook OpenClaw demarre');

// Reception messages Telegram
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;
  if (chatId.toString() !== CONFIG.chatId) return;

  const message = {
    id: Date.now().toString(),
    from: 'telegram',
    user: msg.from?.username || 'User',
    text: text,
    chatId: chatId,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };

  messageQueue.push(message);

  // Afficher dans la console pour Insight
  console.log('\n' + '='.repeat(60));
  console.log('NOUVEAU MESSAGE POUR INSIGHT');
  console.log('='.repeat(60));
  console.log(`ID: ${message.id}`);
  console.log(`De: ${message.user}`);
  console.log(`Message: ${text}`);
  console.log('='.repeat(60));
  console.log(`node insight-respond.js "${message.id}" "Ta reponse"`);
  console.log('='.repeat(60) + '\n');

  await bot.sendMessage(chatId, 'Message envoye a Insight...', { parse_mode: 'Markdown' });
});

// Serveur webhook pour reponses
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === CONFIG.webhookPath) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const originalMsg = messageQueue.find(m => m.id === data.messageId);

        if (originalMsg && data.response) {
          await bot.sendMessage(originalMsg.chatId, data.response, { parse_mode: 'Markdown' });
          originalMsg.status = 'replied';
          console.log('Reponse envoyee');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Message not found' }));
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/messages') {
    // Endpoint pour lister les messages en attente
    const pending = messageQueue.filter(m => m.status === 'pending');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: pending }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(CONFIG.webhookPort, () => {
  console.log(`Webhook: http://localhost:${CONFIG.webhookPort}${CONFIG.webhookPath}`);
  console.log(`Messages en attente: http://localhost:${CONFIG.webhookPort}/messages`);
});

module.exports = { bot, messageQueue };
