require('dotenv').config();
const supabaseService = require('../supabase-config');

async function listPackages() {
  console.log('📦 Listing packages...');
  const { data, error } = await supabaseService.supabase.from('credit_packages').select('*');
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Packages:', data);
  }
}

listPackages();
