require('dotenv').config();
const supabaseService = require('../supabase-config');

async function listUsers() {
  console.log('👥 Listing users...');
  const { data, error } = await supabaseService.supabase.from('users').select('id, email').limit(5);
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Users:', data);
  }
}

listUsers();
