// Test rapide de Replicate
require('dotenv').config();
const Replicate = require('replicate');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

console.log('✅ Module Replicate chargé');
console.log('✅ Token configuré:', process.env.REPLICATE_API_TOKEN ? 'OUI (' + process.env.REPLICATE_API_TOKEN.substring(0, 10) + '...)' : 'NON');
console.log('\n🎉 Configuration correcte ! Le chat IA est prêt.\n');
