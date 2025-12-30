require('dotenv').config();
const supabaseService = require('../supabase-config');

async function testCredits() {
  const userId = '00000000-0000-0000-0000-000000000001';
  console.log('💳 Testing add_credits RPC for user:', userId);
  
  const { data, error } = await supabaseService.supabase.rpc('add_credits', {
    p_user_id: userId,
    p_credits: 10,
    p_bonus_credits: 0,
    p_price_paid_xaf: 0,
    p_description: 'Test RPC'
  });

  if (error) {
    console.error('❌ RPC Failed:', error);
  } else {
    console.log('✅ RPC Success:', data);
  }
}

testCredits();
