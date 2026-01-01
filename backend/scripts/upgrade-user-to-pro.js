/**
 * Script pour basculer un utilisateur vers l'abonnement Pro
 * Usage: node scripts/upgrade-user-to-pro.js
 */

require('dotenv').config();
const supabaseService = require('../supabase-config');

const USER_EMAIL = 'sowaxcom@gmail.com';

async function upgradeUserToPro() {
  const { supabase } = supabaseService;

  console.log(`\n🔄 Mise à niveau de ${USER_EMAIL} vers Pro...\n`);

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
      console.log('✅ Utilisateur trouvé dans la table users:', user.id);

      // Mettre à jour l'utilisateur
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          role: 'pro',
          subscription_status: 'active',
          subscription_plan: 'pro',
          updated_at: new Date().toISOString()
        })
        .eq('email', USER_EMAIL)
        .select();

      if (updateError) {
        console.error('❌ Erreur mise à jour users:', updateError);
      } else {
        console.log('✅ Table users mise à jour:', updatedUser);
      }
    } else {
      console.log('⚠️ Utilisateur non trouvé dans la table users');
    }

    // 2. Vérifier/créer l'abonnement dans user_subscriptions
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_email', USER_EMAIL)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('❌ Erreur recherche abonnement:', subError);
    }

    // Récupérer le plan Pro
    const { data: proPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', 'pro')
      .single();

    if (planError) {
      console.log('⚠️ Plan Pro non trouvé, recherche alternative...');
      // Essayer avec un autre critère
      const { data: allPlans } = await supabase
        .from('subscription_plans')
        .select('*');
      console.log('Plans disponibles:', allPlans?.map(p => p.slug));
    }

    const planId = proPlan?.id;
    const userId = user?.id;

    if (subscription) {
      console.log('✅ Abonnement existant trouvé, mise à jour...');

      const { data: updatedSub, error: updateSubError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // +1 an
          updated_at: new Date().toISOString()
        })
        .eq('user_email', USER_EMAIL)
        .select();

      if (updateSubError) {
        console.error('❌ Erreur mise à jour abonnement:', updateSubError);
      } else {
        console.log('✅ Abonnement mis à jour:', updatedSub);
      }
    } else if (userId && planId) {
      console.log('➕ Création nouvel abonnement Pro...');

      const { data: newSub, error: createSubError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          user_email: USER_EMAIL,
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        })
        .select();

      if (createSubError) {
        console.error('❌ Erreur création abonnement:', createSubError);
      } else {
        console.log('✅ Abonnement créé:', newSub);
      }
    }

    // 3. Vérification finale
    console.log('\n📋 Vérification finale...\n');

    const { data: finalUser } = await supabase
      .from('users')
      .select('id, email, role, subscription_status, subscription_plan')
      .eq('email', USER_EMAIL)
      .single();

    const { data: finalSub } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_email', USER_EMAIL)
      .single();

    console.log('👤 Utilisateur:', finalUser);
    console.log('💳 Abonnement:', finalSub);

    console.log('\n✅ Migration terminée avec succès!\n');

  } catch (error) {
    console.error('❌ Erreur globale:', error);
  }
}

upgradeUserToPro();
