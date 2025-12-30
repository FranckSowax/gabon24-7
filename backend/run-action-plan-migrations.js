const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration(filename) {
  console.log(`\n📄 Exécution de ${filename}...`)
  
  const filePath = path.join(__dirname, 'migrations', filename)
  const sql = fs.readFileSync(filePath, 'utf8')
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      // Si la fonction exec_sql n'existe pas, on essaie directement
      console.log('⚠️  Fonction exec_sql non disponible, exécution manuelle requise')
      console.log('\n📋 Copiez et exécutez ce SQL dans Supabase SQL Editor:')
      console.log('=' .repeat(80))
      console.log(sql)
      console.log('=' .repeat(80))
      return false
    }
    
    console.log(`✅ ${filename} exécuté avec succès`)
    return true
  } catch (err) {
    console.error(`❌ Erreur lors de l'exécution de ${filename}:`, err.message)
    console.log('\n📋 Copiez et exécutez ce SQL dans Supabase SQL Editor:')
    console.log('=' .repeat(80))
    console.log(sql)
    console.log('=' .repeat(80))
    return false
  }
}

async function main() {
  console.log('🚀 Exécution des migrations pour le Plan d\'Action...\n')
  
  const migrations = [
    'create_action_plan_checklist.sql',
    'create_action_plan_documents_bucket.sql'
  ]
  
  for (const migration of migrations) {
    await runMigration(migration)
  }
  
  console.log('\n✅ Migrations terminées!')
  console.log('\n📝 Instructions:')
  console.log('1. Allez sur https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/editor')
  console.log('2. Cliquez sur "SQL Editor"')
  console.log('3. Copiez-collez le SQL affiché ci-dessus')
  console.log('4. Cliquez sur "Run"')
}

main().catch(console.error)
