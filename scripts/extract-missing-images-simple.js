const axios = require('axios');
const cheerio = require('cheerio');

// Test simple d'extraction d'image
async function testImageExtraction(url) {
  try {
    console.log(`🔍 Test extraction pour: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Stratégies d'extraction
    const strategies = [
      { name: 'Open Graph', selector: 'meta[property="og:image"]', attr: 'content' },
      { name: 'Twitter Card', selector: 'meta[name="twitter:image"]', attr: 'content' },
      { name: 'Schema.org', selector: 'meta[itemprop="image"]', attr: 'content' },
      { name: 'Article img', selector: 'article img', attr: 'src' },
      { name: 'Content img', selector: '.content img, .post-content img', attr: 'src' }
    ];

    console.log('\n📊 Résultats par stratégie:');
    
    for (let strategy of strategies) {
      const element = $(strategy.selector).first();
      const imageUrl = element.attr(strategy.attr);
      
      if (imageUrl) {
        let fullUrl = imageUrl;
        if (imageUrl.startsWith('//')) {
          fullUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          const urlObj = new URL(url);
          fullUrl = urlObj.origin + imageUrl;
        }
        
        console.log(`✅ ${strategy.name}: ${fullUrl}`);
        return fullUrl;
      } else {
        console.log(`❌ ${strategy.name}: Aucune image`);
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
    return null;
  }
}

// Test sur une URL spécifique
async function main() {
  const testUrl = process.argv[2] || 'https://www.gabonreview.com/gabon-thierry-yvon-michel-ngoma-veut-rompre-definitivement-avec-la-francafrique/';
  
  console.log('🚀 Test d\'extraction d\'images\n');
  const result = await testImageExtraction(testUrl);
  
  if (result) {
    console.log(`\n🎯 Image finale extraite: ${result}`);
  } else {
    console.log('\n❌ Aucune image trouvée');
  }
}

main().catch(console.error);
