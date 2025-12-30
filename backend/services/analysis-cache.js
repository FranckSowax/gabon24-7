/**
 * Système de cache pour les analyses IA
 * Réduit les coûts en réutilisant les analyses similaires
 */

const crypto = require('crypto');
const supabaseService = require('../supabase-config');

// Cache en mémoire (réinitialisé au redémarrage du serveur)
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 60 * 60 * 1000; // 1 heure

// Configuration
const SIMILARITY_THRESHOLD = 0.85; // 85% de similarité minimum
const CACHE_DB_ENABLED = true; // Utiliser Supabase pour cache persistant
const MAX_CACHE_AGE_DAYS = 7; // Âge max du cache en jours

/**
 * Génère une clé de cache basée sur le contenu
 */
function generateCacheKey(text) {
  // Normaliser le texte
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
  
  // Hash SHA256 pour clé unique
  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');
}

/**
 * Calcule la similarité entre deux textes (Jaccard)
 */
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Normalise le texte pour comparaison
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .slice(0, 1000) // Limiter à 1000 caractères pour performance
    .trim();
}

/**
 * Recherche dans le cache mémoire
 */
function searchMemoryCache(textToAnalyze) {
  const normalized = normalizeText(textToAnalyze);
  const cacheKey = generateCacheKey(normalized);
  
  // Recherche exacte
  if (memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
      console.log('🎯 Cache HIT (memory, exact)');
      return { ...cached.data, _cached: true, _cacheSource: 'memory' };
    } else {
      // Expiré, supprimer
      memoryCache.delete(cacheKey);
    }
  }
  
  // Recherche similaire (plus coûteux)
  for (const [key, value] of memoryCache.entries()) {
    if (Date.now() - value.timestamp >= MEMORY_CACHE_TTL) {
      memoryCache.delete(key);
      continue;
    }
    
    const similarity = calculateSimilarity(normalized, normalizeText(value.originalText));
    if (similarity >= SIMILARITY_THRESHOLD) {
      console.log(`🎯 Cache HIT (memory, ${Math.round(similarity * 100)}% similar)`);
      return { ...value.data, _cached: true, _cacheSource: 'memory', _similarity: similarity };
    }
  }
  
  return null;
}

/**
 * Recherche dans la base de données
 */
async function searchDatabaseCache(textToAnalyze, serviceName = 'analyze-opportunity') {
  if (!CACHE_DB_ENABLED) return null;
  
  try {
    const normalized = normalizeText(textToAnalyze);
    const cacheKey = generateCacheKey(normalized);
    
    // Recherche exacte par hash
    const { data: exactMatch, error: exactError } = await supabaseService.supabase
      .from('analysis_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .eq('service_name', serviceName)
      .gte('created_at', new Date(Date.now() - MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString())
      .order('hit_count', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (!exactError && exactMatch) {
      // Incrémenter compteur d'utilisation
      await supabaseService.supabase
        .from('analysis_cache')
        .update({ 
          hit_count: exactMatch.hit_count + 1,
          last_hit_at: new Date().toISOString()
        })
        .eq('id', exactMatch.id);
      
      console.log(`🎯 Cache HIT (database, exact) - ${exactMatch.hit_count + 1} hits`);
      
      return {
        ...exactMatch.result_data,
        _cached: true,
        _cacheSource: 'database',
        _hitCount: exactMatch.hit_count + 1
      };
    }
    
    // Recherche similaire (limité aux 100 derniers)
    const { data: recentAnalyses, error: recentError } = await supabaseService.supabase
      .from('analysis_cache')
      .select('id, original_text, result_data, hit_count')
      .eq('service_name', serviceName)
      .gte('created_at', new Date(Date.now() - MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (!recentError && recentAnalyses && recentAnalyses.length > 0) {
      for (const analysis of recentAnalyses) {
        const similarity = calculateSimilarity(normalized, normalizeText(analysis.original_text));
        
        if (similarity >= SIMILARITY_THRESHOLD) {
          // Incrémenter compteur
          await supabaseService.supabase
            .from('analysis_cache')
            .update({ 
              hit_count: analysis.hit_count + 1,
              last_hit_at: new Date().toISOString()
            })
            .eq('id', analysis.id);
          
          console.log(`🎯 Cache HIT (database, ${Math.round(similarity * 100)}% similar) - ${analysis.hit_count + 1} hits`);
          
          return {
            ...analysis.result_data,
            _cached: true,
            _cacheSource: 'database',
            _similarity: similarity,
            _hitCount: analysis.hit_count + 1
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur recherche cache DB:', error);
    return null;
  }
}

/**
 * Sauvegarde dans le cache
 */
async function saveToCache(textToAnalyze, resultData, serviceName = 'analyze-opportunity', metadata = {}) {
  const normalized = normalizeText(textToAnalyze);
  const cacheKey = generateCacheKey(normalized);
  
  // 1. Sauvegarder dans le cache mémoire
  memoryCache.set(cacheKey, {
    data: resultData,
    originalText: textToAnalyze,
    timestamp: Date.now()
  });
  
  // Nettoyer le cache mémoire si trop grand
  if (memoryCache.size > 100) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  
  // 2. Sauvegarder dans la base de données
  if (CACHE_DB_ENABLED) {
    try {
      const { error } = await supabaseService.supabase
        .from('analysis_cache')
        .insert({
          cache_key: cacheKey,
          service_name: serviceName,
          original_text: textToAnalyze.slice(0, 5000), // Limiter taille
          result_data: resultData,
          hit_count: 0,
          metadata: metadata,
          created_at: new Date().toISOString()
        });
      
      if (!error) {
        console.log('💾 Analyse sauvegardée dans le cache DB');
      } else if (error.code !== '23505') { // Ignorer duplicates
        console.error('Erreur sauvegarde cache:', error);
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde cache DB:', error);
    }
  }
  
  return true;
}

/**
 * Recherche complète dans tous les caches
 */
async function getCachedAnalysis(textToAnalyze, serviceName = 'analyze-opportunity') {
  // 1. Chercher dans le cache mémoire (le plus rapide)
  const memoryResult = searchMemoryCache(textToAnalyze);
  if (memoryResult) {
    return memoryResult;
  }
  
  // 2. Chercher dans la base de données
  const dbResult = await searchDatabaseCache(textToAnalyze, serviceName);
  if (dbResult) {
    // Ajouter au cache mémoire pour accès futur
    const normalized = normalizeText(textToAnalyze);
    const cacheKey = generateCacheKey(normalized);
    memoryCache.set(cacheKey, {
      data: dbResult,
      originalText: textToAnalyze,
      timestamp: Date.now()
    });
    
    return dbResult;
  }
  
  // 3. Pas de cache trouvé
  console.log('❌ Cache MISS - Nouvelle analyse requise');
  return null;
}

/**
 * Obtient les statistiques du cache
 */
async function getCacheStats() {
  const stats = {
    memory: {
      size: memoryCache.size,
      maxSize: 100
    },
    database: {
      totalEntries: 0,
      totalHits: 0,
      topAnalyses: []
    }
  };
  
  if (CACHE_DB_ENABLED) {
    try {
      // Compter les entrées
      const { count } = await supabaseService.supabase
        .from('analysis_cache')
        .select('*', { count: 'exact', head: true });
      
      stats.database.totalEntries = count || 0;
      
      // Total des hits
      const { data: hitData } = await supabaseService.supabase
        .from('analysis_cache')
        .select('hit_count');
      
      stats.database.totalHits = hitData?.reduce((sum, row) => sum + row.hit_count, 0) || 0;
      
      // Top 5 analyses les plus réutilisées
      const { data: topData } = await supabaseService.supabase
        .from('analysis_cache')
        .select('id, service_name, hit_count, created_at')
        .order('hit_count', { ascending: false })
        .limit(5);
      
      stats.database.topAnalyses = topData || [];
    } catch (error) {
      console.error('Erreur stats cache:', error);
    }
  }
  
  return stats;
}

/**
 * Nettoie le cache ancien
 */
async function cleanOldCache(daysOld = MAX_CACHE_AGE_DAYS) {
  if (!CACHE_DB_ENABLED) return { deleted: 0 };
  
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const { data, error } = await supabaseService.supabase
      .from('analysis_cache')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');
    
    const deletedCount = data?.length || 0;
    console.log(`🧹 Cache nettoyé: ${deletedCount} entrées supprimées`);
    
    return { deleted: deletedCount };
  } catch (error) {
    console.error('Erreur nettoyage cache:', error);
    return { deleted: 0, error: error.message };
  }
}

module.exports = {
  getCachedAnalysis,
  saveToCache,
  getCacheStats,
  cleanOldCache,
  SIMILARITY_THRESHOLD
};
