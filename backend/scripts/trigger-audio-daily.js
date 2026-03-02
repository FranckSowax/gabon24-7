#!/usr/bin/env node
/**
 * Trigger manuel du résumé audio public quotidien.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node backend/scripts/trigger-audio-daily.js
 *
 * Ou si OPENAI_API_KEY est déjà dans l'environnement:
 *   node backend/scripts/trigger-audio-daily.js
 */

const path = require('path')

// Charger les vars du backend/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

// Injecter SUPABASE_URL depuis la config hardcodée si pas dans l'env
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://ykytsadwfqoyusleoflf.supabase.co'
}

// Vérifications
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant.')
  console.error('   Ajoute-le dans backend/.env ou passe-le en variable:')
  console.error('   SUPABASE_SERVICE_ROLE_KEY=xxx node backend/scripts/trigger-audio-daily.js')
  process.exit(1)
}

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY manquant.')
  console.error('   OPENAI_API_KEY=sk-... node backend/scripts/trigger-audio-daily.js')
  process.exit(1)
}

console.log('🚀 Trigger manuel du résumé audio quotidien...')
console.log(`📅 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' })} (heure Gabon)`)
console.log('')

// Charger et exécuter la fonction Netlify
const { handler } = require('../../netlify/functions/scheduled-audio-daily')

handler({})
  .then(result => {
    const body = JSON.parse(result.body)
    console.log('')
    console.log('═══════════════════════════════════')
    console.log(`Status: ${result.statusCode}`)
    console.log(JSON.stringify(body, null, 2))
    console.log('═══════════════════════════════════')
    process.exit(body.success ? 0 : 1)
  })
  .catch(err => {
    console.error('❌ Erreur fatale:', err)
    process.exit(1)
  })
