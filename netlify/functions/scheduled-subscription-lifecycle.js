/**
 * CRON: Subscription Lifecycle Manager
 * Schedule: Every day at 07:00 UTC (08:00 Gabon)
 *
 * 1. Expire subscriptions past their end date
 * 2. Send 7-day renewal reminders (WhatsApp + in-app)
 * 3. Send 1-day renewal reminders (WhatsApp)
 * 4. Grant monthly credits on renewal date (if auto-renew)
 */

const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const WHAPI_TOKEN = process.env.WHAPI_TOKEN || ''
const WHAPI_BASE_URL = 'https://gate.whapi.cloud'
const FRONTEND_URL = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://gaboninsight.com'

// Plan display names
const PLAN_NAMES = {
  'free': 'Freemium',
  'freemium': 'Freemium',
  'premium': 'Premium',
  'discovery': 'Premium',
  'pro': 'Professionnel',
  'enterprise': 'Entreprise',
}

// ============================================
// WHATSAPP HELPERS
// ============================================

async function sendWhatsAppText(phoneNumber, message) {
  if (!WHAPI_TOKEN || !phoneNumber) return null
  try {
    const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '')
    const response = await axios.post(
      `${WHAPI_BASE_URL}/messages/text`,
      { to: cleanNumber, body: message, typing_time: 0 },
      { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    )
    return { success: true, messageId: response.data?.id }
  } catch (err) {
    console.error(`⚠️ WhatsApp envoi échoué (${phoneNumber}):`, err.response?.data?.message || err.message)
    return null
  }
}

async function sendWhatsAppInteractive(phoneNumber, title, body, buttonTitle, buttonUrl) {
  if (!WHAPI_TOKEN || !phoneNumber) return null
  try {
    const cleanNumber = phoneNumber.replace(/[\s\-()]/g, '')
    const payload = {
      to: cleanNumber,
      type: 'button',
      header: { type: 'text', text: title },
      body: { text: body },
      footer: { text: 'Gabon 24/7 - Votre info au quotidien' },
      action: {
        buttons: [
          { type: 'url', title: buttonTitle, id: 'btn_renew', url: buttonUrl }
        ]
      }
    }
    const response = await axios.post(
      `${WHAPI_BASE_URL}/messages/interactive`,
      payload,
      { headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    )
    return { success: true, messageId: response.data?.id }
  } catch (err) {
    console.error(`⚠️ WhatsApp interactive échoué (${phoneNumber}):`, err.response?.data?.message || err.message)
    return null
  }
}

// ============================================
// HELPER: Get user phone from profile
// ============================================

async function getUserPhone(userId) {
  const { data } = await supabase
    .from('users')
    .select('phone_number')
    .eq('id', userId)
    .single()
  return data?.phone_number || null
}

async function getUserEmail(userId) {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email || null
}

// ============================================
// STEP 1: Expire past-due subscriptions
// ============================================

async function expireSubscriptions() {
  const now = new Date().toISOString()

  const { data: expired, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_id, current_period_end, metadata')
    .eq('status', 'active')
    .lt('current_period_end', now)

  if (error) {
    console.error('❌ Erreur récupération abos expirés:', error)
    return { expired: 0 }
  }
  if (!expired || expired.length === 0) {
    console.log('✅ Aucun abonnement à expirer')
    return { expired: 0 }
  }

  console.log(`⏰ ${expired.length} abonnement(s) à expirer`)

  let expiredCount = 0
  for (const sub of expired) {
    // Update status to expired
    const { error: updateErr } = await supabase
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', sub.id)

    if (updateErr) {
      console.error(`❌ Erreur expiration sub ${sub.id}:`, updateErr)
      continue
    }

    // Update user subscription_type to 'free'
    await supabase
      .from('users')
      .update({ subscription_type: 'free', updated_at: new Date().toISOString() })
      .eq('id', sub.user_id)

    // Send expiry notification (if not already sent)
    if (!sub.expired_notified) {
      const phone = await getUserPhone(sub.user_id)
      if (phone) {
        const renewUrl = `${FRONTEND_URL}/mon-profil?tab=subscription`
        await sendWhatsAppInteractive(
          phone,
          '⏰ Abonnement expiré',
          `Votre abonnement Gabon 24/7 a expiré.\n\nRenouvelez maintenant pour continuer à profiter de vos avantages et crédits mensuels.`,
          '🔄 Renouveler',
          renewUrl
        )
      }
      await supabase
        .from('subscriptions')
        .update({ expired_notified: true })
        .eq('id', sub.id)
    }

    expiredCount++
    console.log(`✅ Abonnement ${sub.id} expiré`)
  }

  return { expired: expiredCount }
}

// ============================================
// STEP 2: Send 7-day reminders
// ============================================

async function sendReminders7Days() {
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, current_period_end, reminder_7d_sent, plan_id, metadata')
    .eq('status', 'active')
    .eq('reminder_7d_sent', false)
    .lte('current_period_end', in7Days)
    .gt('current_period_end', now.toISOString())

  if (error || !subs || subs.length === 0) {
    console.log('✅ Aucun rappel 7 jours à envoyer')
    return { reminders_7d: 0 }
  }

  console.log(`📬 ${subs.length} rappel(s) 7 jours à envoyer`)

  let sent = 0
  for (const sub of subs) {
    const phone = await getUserPhone(sub.user_id)
    const endDate = new Date(sub.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    // Get plan name
    let planName = 'votre abonnement'
    if (sub.plan_id) {
      const { data: plan } = await supabase.from('subscription_plans').select('name, slug').eq('id', sub.plan_id).single()
      if (plan) planName = PLAN_NAMES[plan.slug] || plan.name
    }

    if (phone) {
      const renewUrl = `${FRONTEND_URL}/mon-profil?tab=subscription`
      await sendWhatsAppInteractive(
        phone,
        '📅 Rappel - Abonnement',
        `Votre abonnement *${planName}* expire le *${endDate}*.\n\nRenouvelez avant cette date pour ne pas perdre vos avantages et vos crédits mensuels.`,
        '🔄 Renouveler maintenant',
        renewUrl
      )
    }

    await supabase
      .from('subscriptions')
      .update({ reminder_7d_sent: true })
      .eq('id', sub.id)

    sent++
  }

  return { reminders_7d: sent }
}

// ============================================
// STEP 3: Send 1-day reminders (urgent)
// ============================================

async function sendReminders1Day() {
  const now = new Date()
  const in1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, current_period_end, reminder_1d_sent, plan_id')
    .eq('status', 'active')
    .eq('reminder_1d_sent', false)
    .lte('current_period_end', in1Day)
    .gt('current_period_end', now.toISOString())

  if (error || !subs || subs.length === 0) {
    console.log('✅ Aucun rappel 1 jour à envoyer')
    return { reminders_1d: 0 }
  }

  console.log(`🚨 ${subs.length} rappel(s) urgent(s) 1 jour à envoyer`)

  let sent = 0
  for (const sub of subs) {
    const phone = await getUserPhone(sub.user_id)

    let planName = 'votre abonnement'
    if (sub.plan_id) {
      const { data: plan } = await supabase.from('subscription_plans').select('name, slug').eq('id', sub.plan_id).single()
      if (plan) planName = PLAN_NAMES[plan.slug] || plan.name
    }

    if (phone) {
      const renewUrl = `${FRONTEND_URL}/mon-profil?tab=subscription`
      await sendWhatsAppInteractive(
        phone,
        '🚨 Dernière chance !',
        `Votre abonnement *${planName}* expire *demain* !\n\nSans renouvellement, vous perdrez vos crédits mensuels et l'accès aux fonctionnalités premium.\n\nRenouvelez en un clic :`,
        '💳 Renouveler maintenant',
        renewUrl
      )
    }

    await supabase
      .from('subscriptions')
      .update({ reminder_1d_sent: true })
      .eq('id', sub.id)

    sent++
  }

  return { reminders_1d: sent }
}

// ============================================
// MAIN HANDLER
// ============================================

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json' }

  try {
    console.log('🔄 Subscription Lifecycle - Début du traitement...')

    // Step 1: Expire past-due subscriptions
    console.log('\n--- Étape 1: Expiration ---')
    const expiryResult = await expireSubscriptions()

    // Step 2: 7-day reminders
    console.log('\n--- Étape 2: Rappels 7 jours ---')
    const reminder7Result = await sendReminders7Days()

    // Step 3: 1-day reminders
    console.log('\n--- Étape 3: Rappels 1 jour ---')
    const reminder1Result = await sendReminders1Day()

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      ...expiryResult,
      ...reminder7Result,
      ...reminder1Result,
    }

    console.log('\n✅ Subscription Lifecycle terminé:', summary)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(summary),
    }

  } catch (error) {
    console.error('❌ Subscription Lifecycle error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message }),
    }
  }
}
