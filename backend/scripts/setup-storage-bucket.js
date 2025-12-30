const supabaseService = require('../supabase-config');
const { supabase } = supabaseService;

async function setupStorageBucket() {
  try {
    console.log('🗂️ Configuration du bucket Supabase Storage...');

    // 1. Créer le bucket campaign-images
    const { data: bucketData, error: bucketError } = await supabase.storage
      .createBucket('campaign-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('❌ Erreur création bucket:', bucketError);
      return false;
    }

    if (bucketData) {
      console.log('✅ Bucket campaign-images créé avec succès');
    } else {
      console.log('ℹ️ Bucket campaign-images existe déjà');
    }

    // 2. Configurer les politiques RLS pour permettre l'upload et la lecture publique
    const policies = [
      {
        name: 'Allow public uploads to campaign-images',
        definition: `
          CREATE POLICY "Allow public uploads to campaign-images" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'campaign-images');
        `
      },
      {
        name: 'Allow public access to campaign-images',
        definition: `
          CREATE POLICY "Allow public access to campaign-images" ON storage.objects
          FOR SELECT USING (bucket_id = 'campaign-images');
        `
      },
      {
        name: 'Allow public delete from campaign-images',
        definition: `
          CREATE POLICY "Allow public delete from campaign-images" ON storage.objects
          FOR DELETE USING (bucket_id = 'campaign-images');
        `
      }
    ];

    console.log('🔐 Configuration des politiques RLS...');
    
    for (const policy of policies) {
      try {
        const { error: policyError } = await supabase.rpc('exec_sql', {
          sql: policy.definition
        });
        
        if (policyError && !policyError.message.includes('already exists')) {
          console.warn(`⚠️ Politique ${policy.name}:`, policyError.message);
        } else {
          console.log(`✅ Politique configurée: ${policy.name}`);
        }
      } catch (err) {
        console.warn(`⚠️ Erreur politique ${policy.name}:`, err.message);
      }
    }

    // 3. Tester l'upload avec un fichier de test
    console.log('🧪 Test d\'upload...');
    
    const testData = Buffer.from('test image data');
    const testFileName = `test-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('campaign-images')
      .upload(testFileName, testData, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.error('❌ Erreur test upload:', uploadError);
      return false;
    }

    console.log('✅ Test upload réussi:', uploadData.path);

    // Nettoyer le fichier de test
    await supabase.storage
      .from('campaign-images')
      .remove([testFileName]);

    console.log('🎉 Configuration du bucket terminée avec succès!');
    return true;

  } catch (error) {
    console.error('❌ Erreur configuration bucket:', error);
    return false;
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  setupStorageBucket()
    .then(success => {
      if (success) {
        console.log('✅ Setup terminé avec succès');
        process.exit(0);
      } else {
        console.log('❌ Setup échoué');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { setupStorageBucket };
