/**
 * Debug script for RAG service
 * Run with: node scripts/debug-rag.js
 */

require('dotenv').config();
const GeminiRAGService = require('../services/gemini-rag.service');

async function debugRAG() {
  console.log('=== DEBUG RAG SERVICE ===\n');

  // 1. Check API Key
  console.log('1. Checking GEMINI_API_KEY...');
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is NOT SET!');
    console.log('   Add GEMINI_API_KEY to your Railway environment variables.');
    return;
  }
  console.log('✅ GEMINI_API_KEY is set (length:', process.env.GEMINI_API_KEY.length, ')\n');

  // 2. Initialize service
  console.log('2. Initializing RAG Service...');
  const ragService = new GeminiRAGService();
  console.log('✅ Service initialized\n');

  // 3. Try to find/create store
  console.log('3. Looking for FileSearchStore...');
  try {
    const store = await ragService.findStore();
    if (store) {
      console.log('✅ Store found:', store.name);
      console.log('   Display Name:', store.displayName);
    } else {
      console.log('⚠️ No store found. Creating one...');
      try {
        const newStore = await ragService.createStore();
        console.log('✅ Store created:', newStore.name);
      } catch (createError) {
        console.error('❌ Failed to create store:', createError.message);
        if (createError.response?.data) {
          console.error('   API Response:', JSON.stringify(createError.response.data, null, 2));
        }
      }
    }
  } catch (error) {
    console.error('❌ Error finding store:', error.message);
    if (error.response?.data) {
      console.error('   API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // 4. Try a simple chat
  console.log('\n4. Testing chat function...');
  try {
    const result = await ragService.chat('Bonjour, qui es-tu?');
    if (result.success) {
      console.log('✅ Chat successful!');
      console.log('   Response:', result.text.substring(0, 200) + '...');
    } else {
      console.log('❌ Chat failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Chat error:', error.message);
  }

  console.log('\n=== DEBUG COMPLETE ===');
}

debugRAG().catch(console.error);
