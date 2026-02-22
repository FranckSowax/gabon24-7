#!/usr/bin/env node
/**
 * 📊 MONITOR.JS
 * Surveillance Gabon 24/7
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const CONFIG = {
  apiUrl: process.env.GABON247_API_URL || 'https://gabon24-7-production.up.railway.app',
  adminToken: process.env.GABON247_ADMIN_TOKEN,
  supabaseUrl: process.env.SUPABASE_URL || 'https://ykytsadwfqoyusleoflf.supabase.co',
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  telegramToken: process.env.NOTIF_BOT_TOKEN,
  telegramChatId: process.env.NOTIF_CHAT_ID || '1903781052'
};

const supabase = CONFIG.supabaseKey
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey)
  : null;

class Monitor {
  async checkHealth() {
    try {
      const { data } = await axios.get(`${CONFIG.apiUrl}/health`);
      return { status: data.data?.status, healthy: data.data?.status === 'healthy' };
    } catch (error) {
      return { status: 'error', healthy: false };
    }
  }

  async getAdminStats() {
    if (!CONFIG.adminToken) return { error: 'GABON247_ADMIN_TOKEN non défini' };
    try {
      const { data } = await axios.get(`${CONFIG.apiUrl}/api/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${CONFIG.adminToken}` }
      });
      return data;
    } catch (error) {
      return { error: error.message };
    }
  }

  async getAIStats() {
    if (!CONFIG.adminToken) return { error: 'GABON247_ADMIN_TOKEN non défini' };
    try {
      const { data } = await axios.get(`${CONFIG.apiUrl}/api/ai/admin/status`, {
        headers: { 'Authorization': `Bearer ${CONFIG.adminToken}` }
      });
      return {
        percentageUsed: data.quota?.percentageUsed,
        remainingBudget: data.quota?.remainingBudget
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async sendTelegram(message) {
    if (!CONFIG.telegramToken) return;
    const url = `https://api.telegram.org/bot${CONFIG.telegramToken}/sendMessage`;
    await axios.post(url, { chat_id: CONFIG.telegramChatId, text: message, parse_mode: 'Markdown' });
  }

  async run() {
    console.log('📊 Monitoring Gabon 24/7...\n');

    const health = await this.checkHealth();
    const stats = await this.getAdminStats();
    const ai = await this.getAIStats();

    console.log(`🟢 Santé: ${health.healthy ? 'OK' : 'ERROR'}`);
    console.log(`📰 Articles: ${stats.totalArticles || 'N/A'}`);
    console.log(`👥 Users: ${stats.totalUsers || 'N/A'}`);
    console.log(`🤖 IA Quota: ${ai.percentageUsed || 'N/A'}%`);

    // Alertes
    if (!health.healthy) {
      await this.sendTelegram('🚨 *GABON 24/7* - App unhealthy');
    }
    if (ai.percentageUsed > 90) {
      await this.sendTelegram(`🚨 *GABON 24/7* - Quota IA à ${ai.percentageUsed}%`);
    }

    console.log('\n✅ Monitoring terminé');
  }
}

new Monitor().run();
