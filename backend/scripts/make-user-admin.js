/**
 * Script pour passer un utilisateur en administrateur
 * Usage: node scripts/make-user-admin.js
 */

require('dotenv').config();
const supabaseService = require('../supabase-config');

const USER_EMAIL = 'sowaxcom@gmail.com';

async function makeUserAdmin() {
  const { supabase } = supabaseService;

  console.log(`\n🔐 Passage de ${USER_EMAIL} en administrateur...\n`);

  try {
    // 1. Trouver l'utilisateur par email dans la table users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', USER_EMAIL)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      console.error('❌ Erreur recherche utilisateur:', userError);
    }

    if (user) {
      console.log('✅ Utilisateur trouvé:', user.id);

      // Mettre à jour l'utilisateur en admin
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          is_admin: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', USER_EMAIL)
        .select();

      if (updateError) {
        console.error('❌ Erreur mise à jour:', updateError);
      } else {
        console.log('✅ Utilisateur mis à jour en ADMIN:', updatedUser);
      }
    } else {
      console.log('⚠️ Utilisateur non trouvé dans la table users');
      console.log('   Tentative de recherche dans auth.users...');

      // Chercher l'utilisateur via Supabase Auth (si table users pas synchro)
      // Note: Cela nécessite service_role key
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error('❌ Erreur listUsers:', authError);
      } else {
        const authUser = authUsers?.users?.find(u => u.email === USER_EMAIL);
        if (authUser) {
          console.log('✅ Utilisateur trouvé dans auth.users:', authUser.id);

          // Créer l'entrée dans la table users
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .upsert({
              id: authUser.id,
              email: USER_EMAIL,
              is_admin: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' })
            .select();

          if (createError) {
            console.error('❌ Erreur création utilisateur:', createError);
          } else {
            console.log('✅ Utilisateur admin créé:', newUser);
          }
        } else {
          console.log('❌ Utilisateur non trouvé nulle part');
          console.log('   Emails disponibles:', authUsers?.users?.map(u => u.email).slice(0, 5));
        }
      }
    }

    // 2. Vérification finale
    console.log('\n📋 Vérification finale...\n');

    const { data: finalUser } = await supabase
      .from('users')
      .select('id, email, is_admin, subscription_type')
      .eq('email', USER_EMAIL)
      .single();

    if (finalUser) {
      console.log('👤 Statut utilisateur:');
      console.log(`   Email: ${finalUser.email}`);
      console.log(`   Subscription: ${finalUser.subscription_type}`);
      console.log(`   Is Admin: ${finalUser.is_admin}`);

      if (finalUser.is_admin) {
        console.log('\n✅ L\'utilisateur est maintenant ADMINISTRATEUR!\n');
      } else {
        console.log('\n⚠️ L\'utilisateur n\'est PAS administrateur\n');
      }
    } else {
      console.log('❌ Utilisateur non trouvé pour vérification');
    }

  } catch (error) {
    console.error('❌ Erreur globale:', error);
  }
}

makeUserAdmin();
