const supabaseService = require('./supabase-config');

async function createTrafficRoutesTable() {
  try {
    console.log('📍 Création de la table traffic_routes...\n');
    
    // Créer la table via SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.traffic_routes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT,
        embed_url TEXT,
        html_content TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        category TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Index pour améliorer les performances
      CREATE INDEX IF NOT EXISTS idx_traffic_routes_active ON public.traffic_routes(is_active);
      CREATE INDEX IF NOT EXISTS idx_traffic_routes_order ON public.traffic_routes(display_order);
      CREATE INDEX IF NOT EXISTS idx_traffic_routes_category ON public.traffic_routes(category);

      -- Fonction pour mettre à jour updated_at automatiquement
      CREATE OR REPLACE FUNCTION update_traffic_routes_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger pour mettre à jour updated_at
      DROP TRIGGER IF EXISTS trigger_update_traffic_routes_updated_at ON public.traffic_routes;
      CREATE TRIGGER trigger_update_traffic_routes_updated_at
        BEFORE UPDATE ON public.traffic_routes
        FOR EACH ROW
        EXECUTE FUNCTION update_traffic_routes_updated_at();
    `;

    const { data, error } = await supabaseService.supabase.rpc('exec_sql', { 
      sql_query: createTableSQL 
    });

    if (error) {
      // Si la fonction RPC n'existe pas, essayons une approche différente
      console.log('⚠️  Tentative directe...');
      
      // Insérer directement les routes de démonstration
      const demoRoutes = [
        {
          title: 'PK8 → Centre-ville',
          subtitle: 'Distance: 8km | Durée estimée: 15 min',
          embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d15958.699!2d9.4523!3d0.4162!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a8c0d0d0d0d%3A0x1a1a1a1a1a1a1a1a!2sPK8%2C%20Libreville!3m2!1d0.4162!2d9.4523!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2sCentre-ville%2C%20Libreville!3m2!1d0.4987!2d9.3924!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
          display_order: 1,
          is_active: true,
          category: 'morning'
        },
        {
          title: 'Owendo → Centre-ville',
          subtitle: 'Distance: 12km | Durée estimée: 20 min',
          embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.469!2d9.5023!3d0.2987!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f3a1a1a1a1a1a%3A0x2b2b2b2b2b2b2b2b!2sOwendo%2C%20Gabon!3m2!1d0.2987!2d9.5023!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2sCentre-ville%2C%20Libreville!3m2!1d0.4987!2d9.3924!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
          display_order: 2,
          is_active: true,
          category: 'morning'
        },
        {
          title: 'Nzeng-Ayong → Centre-ville',
          subtitle: 'Distance: 10km | Durée estimée: 18 min',
          embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d15958.234!2d9.4789!3d0.4523!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2b5b5b5b5b5b%3A0x3c3c3c3c3c3c3c3c!2sNzeng-Ayong%2C%20Libreville!3m2!1d0.4523!2d9.4789!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2sCentre-ville%2C%20Libreville!3m2!1d0.4987!2d9.3924!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
          display_order: 3,
          is_active: true,
          category: 'morning'
        },
        {
          title: 'Centre-ville → Aéroport',
          subtitle: 'Distance: 15km | Durée estimée: 25 min',
          embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.469!2d9.375362!3d0.4698661!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2sCentre-ville%2C%20Libreville!3m2!1d0.4987!2d9.3924!4m5!1s0x107f2b2b2b2b2b2b%3A0xfedcba0987654321!2sA%C3%A9roport%20International%20L%C3%A9on-Mba!3m2!1d0.4410!2d9.4177!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
          display_order: 4,
          is_active: true,
          category: 'evening'
        },
        {
          title: 'Centre-ville → PK8',
          subtitle: 'Distance: 8km | Durée estimée: 18 min',
          embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d15958.699!2d9.4523!3d0.4162!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2sCentre-ville%2C%20Libreville!3m2!1d0.4987!2d9.3924!4m5!1s0x107f2a8c0d0d0d0d%3A0x1a1a1a1a1a1a1a1a!2sPK8%2C%20Libreville!3m2!1d0.4162!2d9.4523!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
          display_order: 5,
          is_active: true,
          category: 'evening'
        },
        {
          title: 'Centre-ville → Owendo',
          subtitle: 'Distance: 12km | Durée estimée: 22 min',
          embed_url: 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.469!2d9.5023!3d0.2987!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x107f2a2a2a2a2a2a%3A0x1234567890abcdef!2sCentre-ville%2C%20Libreville!3m2!1d0.4987!2d9.3924!4m5!1s0x107f3a1a1a1a1a1a%3A0x2b2b2b2b2b2b2b2b!2sOwendo%2C%20Gabon!3m2!1d0.2987!2d9.5023!5e0!3m2!1sfr!2sga!4v1694598000000!5m2!1sfr!2sga',
          display_order: 6,
          is_active: true,
          category: 'evening'
        }
      ];

      console.log('📝 Insertion des routes de démonstration...\n');

      const { data: insertedRoutes, error: insertError } = await supabaseService.supabase
        .from('traffic_routes')
        .insert(demoRoutes)
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log(`✅ ${insertedRoutes.length} routes insérées avec succès!\n`);
      
      insertedRoutes.forEach((route, index) => {
        console.log(`[${index + 1}] ${route.title}`);
        console.log(`    Catégorie: ${route.category}`);
        console.log(`    Ordre: ${route.display_order}\n`);
      });

      return;
    }

    console.log('✅ Table traffic_routes créée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  }
}

createTrafficRoutesTable();
