const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Supabase non configuré'
      })
    };
  }

  try {
    // Articles à supprimer basés sur les titres exacts des articles Supabase
    const articlesToDelete = [
      {
        titlePattern: '%Alex Mba Nyare%',
        titlePattern2: '%Ndjolé Debout%'
      },
      {
        titlePattern: '%dégradation croissante%',
        titlePattern2: '%Ndjolé%'
      },
      {
        titlePattern: '%Miss Tourisme Gabon 2025%',
        author: 'Hans NDONG MEBALE'
      },
      {
        titlePattern: '%Tita Nzebi%',
        titlePattern2: '%Huguette Leckat%'
      }
    ];

    let totalDeleted = 0;
    const deletedArticles = [];

    for (const articleCriteria of articlesToDelete) {
      // Rechercher les articles correspondants avec plusieurs patterns
      let foundArticles = [];
      
      // Recherche avec le premier pattern de titre
      if (articleCriteria.titlePattern) {
        const { data: articles1, error: error1 } = await supabase
          .from('articles')
          .select('id, title, author, source')
          .ilike('title', articleCriteria.titlePattern);
          
        if (!error1 && articles1) {
          foundArticles.push(...articles1);
        }
      }
      
      // Recherche avec le deuxième pattern de titre
      if (articleCriteria.titlePattern2) {
        const { data: articles2, error: error2 } = await supabase
          .from('articles')
          .select('id, title, author, source')
          .ilike('title', articleCriteria.titlePattern2);
          
        if (!error2 && articles2) {
          foundArticles.push(...articles2);
        }
      }
      
      // Recherche par auteur si spécifié
      if (articleCriteria.author) {
        const { data: articles3, error: error3 } = await supabase
          .from('articles')
          .select('id, title, author, source')
          .eq('author', articleCriteria.author);
          
        if (!error3 && articles3) {
          foundArticles.push(...articles3);
        }
      }

      // Dédupliquer les articles trouvés
      const uniqueArticles = foundArticles.filter((article, index, self) => 
        index === self.findIndex(a => a.id === article.id)
      );

      if (uniqueArticles.length > 0) {
        // Supprimer les articles trouvés
        const articleIds = uniqueArticles.map(article => article.id);
        
        const { error: deleteError } = await supabase
          .from('articles')
          .delete()
          .in('id', articleIds);

        if (deleteError) {
          console.error('Erreur suppression:', deleteError);
        } else {
          totalDeleted += uniqueArticles.length;
          deletedArticles.push(...uniqueArticles);
          console.log(`✅ ${uniqueArticles.length} articles supprimés pour:`, articleCriteria);
        }
      }
    }

    // Recherche et suppression supplémentaire pour les articles de L'Union avec Abel EYEGHE EKORE
    const { data: unionArticles, error: unionError } = await supabase
      .from('articles')
      .select('id, title, author, source')
      .eq('source', 'L\'Union')
      .eq('author', 'Abel EYEGHE EKORE');

    if (!unionError && unionArticles && unionArticles.length > 0) {
      const unionIds = unionArticles.map(article => article.id);
      
      const { error: deleteUnionError } = await supabase
        .from('articles')
        .delete()
        .in('id', unionIds);

      if (!deleteUnionError) {
        totalDeleted += unionArticles.length;
        deletedArticles.push(...unionArticles);
        console.log(`✅ ${unionArticles.length} articles L'Union/Abel EYEGHE EKORE supprimés`);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${totalDeleted} articles supprimés avec succès`,
        deleted_count: totalDeleted,
        deleted_articles: deletedArticles.map(article => ({
          id: article.id,
          title: article.title,
          author: article.author,
          source: article.source
        })),
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans delete-articles:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
