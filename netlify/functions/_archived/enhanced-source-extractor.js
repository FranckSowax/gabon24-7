const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cache des sources détectées (évite le re-scraping)
const sourceCache = new Map();

// Fonction principale d'extraction de source améliorée
async function enhancedExtractSourceFromLink(link, articleContent = null) {
  if (!link) return 'Source inconnue';
  
  try {
    const url = new URL(link);
    let domain = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.|amp\.)/, '');
    
    // Vérifier le cache
    if (sourceCache.has(domain)) {
      return sourceCache.get(domain);
    }
    
    // Niveau 1: Mapping existant rapide
    const mappedSource = getExistingMapping(domain);
    if (mappedSource !== domain) {
      sourceCache.set(domain, mappedSource);
      return mappedSource;
    }
    
    // Niveau 2: Scraping métadonnées (si pas en cache)
    const scrapedSource = await extractSourceFromMetadata(link);
    if (scrapedSource) {
      sourceCache.set(domain, scrapedSource);
      await saveSourceToDatabase(domain, scrapedSource, 'metadata');
      return scrapedSource;
    }
    
    // Niveau 3: Analyse du contenu de l'article
    const contentSource = extractSourceFromContent(articleContent);
    if (contentSource) {
      sourceCache.set(domain, contentSource);
      return contentSource;
    }
    
    // Niveau 4: Transformation intelligente du domaine
    const transformedSource = smartDomainTransform(domain);
    if (transformedSource !== domain) {
      sourceCache.set(domain, transformedSource);
      await saveSourceToDatabase(domain, transformedSource, 'transform');
      return transformedSource;
    }
    
    return domain; // Fallback final
    
  } catch (error) {
    console.error('Erreur extraction source:', error);
    return 'Source inconnue';
  }
}

// Niveau 1: Mapping existant (optimisé)
function getExistingMapping(domain) {
  const sourceMap = {
    // Sources principales gabonaises
    'echosdeleco.com': 'Echos de l\'Eco',
    'gabonactu.com': 'Gabon Actu',
    'agpgabon.ga': 'AGP - Agence Gabonaise de Presse',
    'gabonallsport.com': 'Gabon All Sport',
    'gaboneco.com': 'GabonEco',
    'mediapostegabon.com': 'MediaPost Gabon',
    'union.sonapresse.com': 'L\'Union',
    '7joursinfo.com': '7 Jours Info',
    'gabonmediatime.com': 'Gabon Media Time',
    'gabonmailinfos.com': 'Gabon Mail Infos',
    'africaintelligence.fr': 'Africa Intelligence',
    'agencequateur.com': 'Agence Equateur',
    'courrierdesjournalistes.net': 'Courrier des Journalistes',
    'directinfosgabon.com': 'Direct Infos Gabon',
    'focusgroupemedia.com': 'Focus Groupe Media',
    'afrique.latribune.fr': 'La Tribune Afrique',
    'rfi.fr': 'RFI',
    'gabonews.com': 'Gabonews',
    'depeches241.com': 'Dépêches 241',
    'fr.infosgabon.com': 'InfosGabon',
    'infosgabon.com': 'InfosGabon',
    'insidenews241.com': 'Inside News 241',
    'journaldugabon.com': 'Journal du Gabon',
    'kongossanews.info': 'Kongossa News',
    'letouracovert.com': 'Le Touraco Vert',
    'sport241.com': 'Sport 241'
  };
  
  return sourceMap[domain] || checkDomainPatterns(domain) || domain;
}

// Patterns intelligents pour domaines non mappés
function checkDomainPatterns(domain) {
  const patterns = [
    { regex: /.*gabon.*news.*/i, name: 'Gabon News' },
    { regex: /.*union.*gabon.*/i, name: 'L\'Union' },
    { regex: /.*info.*gabon.*/i, name: 'Info Gabon' },
    { regex: /.*actualite.*gabon.*/i, name: 'Actualités Gabon' },
    { regex: /.*media.*gabon.*/i, name: 'Media Gabon' },
    { regex: /.*journal.*gabon.*/i, name: 'Journal du Gabon' },
    { regex: /.*presse.*gabon.*/i, name: 'Presse Gabon' }
  ];
  
  for (const pattern of patterns) {
    if (pattern.regex.test(domain)) {
      return pattern.name;
    }
  }
  
  return null;
}

// Niveau 2: Scraping métadonnées web
async function extractSourceFromMetadata(url) {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Gabon24-7 Source Extractor Bot 1.0'
      }
    });
    
    const html = response.data;
    
    // Extraire métadonnées Open Graph
    const ogSiteName = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/i)?.[1];
    if (ogSiteName && ogSiteName.length < 50) {
      return cleanSourceName(ogSiteName);
    }
    
    // Extraire depuis la balise title
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    if (title) {
      const sourceFromTitle = extractSourceFromTitle(title);
      if (sourceFromTitle) return sourceFromTitle;
    }
    
    // Extraire depuis meta author
    const author = html.match(/<meta\s+name="author"\s+content="([^"]+)"/i)?.[1];
    if (author && author.length < 30) {
      return cleanSourceName(author);
    }
    
    return null;
  } catch (error) {
    console.warn('Erreur scraping métadonnées:', error.message);
    return null;
  }
}

// Extraire source depuis le titre de la page
function extractSourceFromTitle(title) {
  // Patterns courants dans les titres
  const patterns = [
    /\|\s*([^|]+)$/,           // "Article | Source"
    /-\s*([^-]+)$/,           // "Article - Source"
    /\s*-\s*([^-]+)\s*$/,     // "Article - Source"
    /sur\s+([^|]+)/i,         // "Article sur Source"
    /par\s+([^|]+)/i          // "Article par Source"
  ];
  
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      if (candidate.length > 3 && candidate.length < 30) {
        return cleanSourceName(candidate);
      }
    }
  }
  
  return null;
}

// Niveau 3: Analyse du contenu de l'article
function extractSourceFromContent(content) {
  if (!content) return null;
  
  // Rechercher des mentions de sources dans le contenu
  const sourcePatterns = [
    /selon\s+([A-Z][a-zA-Zàâäéèêëïîôöùûüÿç\s]{3,25})/i,
    /source\s*:\s*([A-Z][a-zA-Zàâäéèêëïîôöùûüÿç\s]{3,25})/i,
    /d'après\s+([A-Z][a-zA-Zàâäéèêëïîôöùûüÿç\s]{3,25})/i,
    /rapporte\s+([A-Z][a-zA-Zàâäéèêëïîôöùûüÿç\s]{3,25})/i
  ];
  
  for (const pattern of sourcePatterns) {
    const match = content.match(pattern);
    if (match) {
      const candidate = match[1].trim();
      if (isValidSourceName(candidate)) {
        return cleanSourceName(candidate);
      }
    }
  }
  
  return null;
}

// Niveau 4: Transformation intelligente du domaine
function smartDomainTransform(domain) {
  // Supprimer TLD et nettoyer
  let name = domain
    .replace(/\.(com|ga|net|org|info|fr)$/i, '')
    .replace(/^(www|m|mobile|amp)\./, '');
  
  // Transformations spéciales pour le Gabon
  name = name
    .replace(/gabon/gi, 'Gabon')
    .replace(/241/g, '241')
    .replace(/news/gi, 'News')
    .replace(/info/gi, 'Info')
    .replace(/media/gi, 'Media')
    .replace(/journal/gi, 'Journal')
    .replace(/presse/gi, 'Presse');
  
  // Diviser sur les délimiteurs et capitaliser
  const words = name.split(/[-_.]/).filter(word => word.length > 0);
  
  if (words.length > 1) {
    return words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
  
  // Si un seul mot, capitaliser proprement
  if (name.length > 3) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  
  return domain; // Fallback
}

// Utilitaires
function cleanSourceName(name) {
  return name
    .replace(/[^\w\s\-àâäéèêëïîôöùûüÿç']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidSourceName(name) {
  return name && 
         name.length >= 3 && 
         name.length <= 50 && 
         !/^\d+$/.test(name) &&
         !/(article|titre|contenu|page)/i.test(name);
}

// Sauvegarder source détectée en base
async function saveSourceToDatabase(domain, sourceName, method) {
  try {
    await supabase
      .from('detected_sources')
      .upsert({
        domain: domain,
        source_name: sourceName,
        detection_method: method,
        detected_at: new Date().toISOString()
      }, {
        onConflict: 'domain'
      });
  } catch (error) {
    console.warn('Erreur sauvegarde source:', error);
  }
}

// Fonction Netlify Handler
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { url, content } = JSON.parse(event.body || '{}');
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL requise' })
      };
    }
    
    const source = await enhancedExtractSourceFromLink(url, content);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url,
        source,
        cached: sourceCache.has(new URL(url).hostname.toLowerCase())
      })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

module.exports = { enhancedExtractSourceFromLink };
