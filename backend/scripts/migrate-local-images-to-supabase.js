const fs = require('fs');
const path = require('path');
const supabaseService = require('../supabase-config');
const supabase = supabaseService.supabase;

/**
 * Script pour migrer les images locales vers Supabase Storage
 * et mettre à jour les URLs dans la base de données
 */

async function migrateImages() {
  console.log('🚀 Démarrage migration images vers Supabase Storage...\n');

  try {
    // 1. Récupérer tous les slides avec URLs relatives
    const { data: slides, error: fetchError } = await supabase
      .from('promotional_slides')
      .select('id, title, image_url')
      .like('image_url', '/%');

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📋 Trouvé ${slides.length} slide(s) avec URLs relatives\n`);

    if (slides.length === 0) {
      console.log('✅ Aucune migration nécessaire!');
      return;
    }

    // 2. Pour chaque slide
    for (const slide of slides) {
      console.log(`\n📸 Traitement: ${slide.title}`);
      console.log(`   URL actuelle: ${slide.image_url}`);

      // Chemin local de l'image
      const localImagePath = path.join(__dirname, '../../frontend/public', slide.image_url);
      
      // Vérifier si l'image existe localement
      if (!fs.existsSync(localImagePath)) {
        console.log(`   ⚠️ Image non trouvée localement: ${localImagePath}`);
        continue;
      }

      // Nom du fichier
      const fileName = path.basename(slide.image_url);
      
      // Lire le fichier
      const fileBuffer = fs.readFileSync(localImagePath);
      
      // Déterminer le content type
      const ext = path.extname(fileName).toLowerCase();
      const contentTypeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      const contentType = contentTypeMap[ext] || 'image/jpeg';

      // Upload vers Supabase Storage
      console.log(`   📤 Upload vers Supabase Storage...`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('campaign-images')
        .upload(fileName, fileBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: true // Remplacer si existe déjà
        });

      if (uploadError) {
        console.error(`   ❌ Erreur upload: ${uploadError.message}`);
        continue;
      }

      // Obtenir l'URL publique
      const { data: publicUrlData } = supabase.storage
        .from('campaign-images')
        .getPublicUrl(fileName);

      const newImageUrl = publicUrlData.publicUrl;
      console.log(`   ✅ Uploadé: ${newImageUrl}`);

      // Mettre à jour la base de données
      const { error: updateError } = await supabase
        .from('promotional_slides')
        .update({ image_url: newImageUrl })
        .eq('id', slide.id);

      if (updateError) {
        console.error(`   ❌ Erreur mise à jour DB: ${updateError.message}`);
        continue;
      }

      console.log(`   ✅ Base de données mise à jour`);
    }

    console.log('\n\n✅ Migration terminée avec succès!');

  } catch (error) {
    console.error('\n❌ Erreur migration:', error);
    process.exit(1);
  }
}

// Exécuter
migrateImages()
  .then(() => {
    console.log('\n🎉 Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
