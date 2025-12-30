/**
 * Script pour configurer le bucket Storage audio-summaries
 */

const supabaseService = require('./supabase-config');

async function setupStorage() {
  try {
    console.log('🚀 Configuration du Storage audio...\n');
    
    const bucketName = 'audio-summaries';
    
    // Vérifier si le bucket existe
    const { data: buckets, error: listError } = await supabaseService.supabase
      .storage
      .listBuckets();
    
    if (listError) {
      console.error('❌ Erreur liste buckets:', listError.message);
      process.exit(1);
    }
    
    const bucketExists = buckets.some(b => b.name === bucketName);
    
    if (bucketExists) {
      console.log('✅ Bucket "audio-summaries" existe déjà');
    } else {
      console.log('📦 Création du bucket "audio-summaries"...');
      
      const { data, error } = await supabaseService.supabase
        .storage
        .createBucket(bucketName, {
          public: true,
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav']
        });
      
      if (error) {
        console.error('❌ Erreur création bucket:', error.message);
        process.exit(1);
      }
      
      console.log('✅ Bucket créé avec succès');
    }
    
    // Tester l'upload
    console.log('\n🧪 Test d\'upload...');
    const testContent = Buffer.from('test audio file');
    const testFileName = `test-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabaseService.supabase
      .storage
      .from(bucketName)
      .upload(testFileName, testContent, {
        contentType: 'audio/mpeg'
      });
    
    if (uploadError) {
      console.error('❌ Erreur test upload:', uploadError.message);
    } else {
      console.log('✅ Test upload réussi');
      
      // Récupérer l'URL publique
      const { data: urlData } = supabaseService.supabase
        .storage
        .from(bucketName)
        .getPublicUrl(testFileName);
      
      console.log('🔗 URL publique:', urlData.publicUrl);
      
      // Supprimer le fichier test
      await supabaseService.supabase
        .storage
        .from(bucketName)
        .remove([testFileName]);
      
      console.log('🗑️  Fichier test supprimé');
    }
    
    console.log('\n✅ Configuration Storage terminée !');
    console.log('📋 Le système audio est prêt à fonctionner');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

setupStorage();
