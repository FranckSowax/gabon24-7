/**
 * Service de Correction des Sources Médias
 * Applique les corrections définies dans "Correctif Source Media.md"
 */

class SourceMediaCorrector {
  constructor() {
    // Mapping domaine → nom propre du média
    this.domainMapping = {
      'gabonmailinfos.com': 'Gabon Mail Infos',
      'gabonallsport.com': 'Gabon All Sport',
      'gabonclic.info': 'Gabon Clic Infos',
      'gaboneco.com': 'GabonEco',
      'gnextnews.com': 'G Next News',
      'sport241.com': 'Sport 241',
      'gaboma.info': 'Gaboma Info',
      'kongossanews.info': 'Kongossa News',
      'depeches241.com': 'Dépêches 241',
      'courrierdesjournalistes.net': 'Courrier des Journalistes',
      'fr.infosgabon.com': 'Infos Gabon',
      'biba241.com': 'Biba 241'
    };
  }

  /**
   * Corrige la source média selon les règles du correctif
   * @param {string} url - URL de l'article
   * @param {string} currentSource - Source actuelle (peut être null)
   * @param {string} author - Auteur de l'article (pour règle Facebook)
   * @returns {string} - Source corrigée
   */
  correctSource(url, currentSource = null, author = null) {
    if (!url) return currentSource || 'Source inconnue';

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase().replace('www.', '');

      // Règle spéciale Facebook : utiliser l'auteur comme source
      if (hostname.includes('facebook.com')) {
        if (author && author.trim() !== '') {
          return author.trim();
        }
        return 'Facebook';
      }

      // Rechercher dans le mapping par domaine exact
      if (this.domainMapping[hostname]) {
        return this.domainMapping[hostname];
      }

      // Rechercher par domaine partiel (pour sous-domaines)
      for (const [domain, sourceName] of Object.entries(this.domainMapping)) {
        if (hostname.includes(domain)) {
          return sourceName;
        }
      }

      // Si pas de mapping trouvé, retourner la source actuelle ou extraire du domaine
      return currentSource || this.extractSourceFromDomain(hostname);
    } catch (error) {
      console.error('Erreur correction source:', error.message);
      return currentSource || 'Source inconnue';
    }
  }

  /**
   * Extrait un nom de source depuis le nom de domaine
   * @param {string} hostname - Nom de domaine
   * @returns {string} - Nom de source formaté
   */
  extractSourceFromDomain(hostname) {
    // Retirer les TLD communs
    let name = hostname
      .replace(/\.(com|net|org|info|ga|cm|fr)$/i, '')
      .replace(/\./g, ' ');
    
    // Capitaliser les mots
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Vérifie si une source nécessite une correction
   * @param {string} url - URL de l'article
   * @param {string} currentSource - Source actuelle
   * @returns {boolean} - True si correction nécessaire
   */
  needsCorrection(url, currentSource) {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
      
      // Vérifier si le domaine est dans le mapping
      const hasMappingExact = this.domainMapping[hostname];
      const hasMappingPartial = Object.keys(this.domainMapping).some(domain => 
        hostname.includes(domain)
      );
      
      if (hasMappingExact || hasMappingPartial) {
        const correctSource = this.correctSource(url, currentSource);
        return currentSource !== correctSource;
      }
      
      // Vérifier règle Facebook
      if (hostname.includes('facebook.com')) {
        return !currentSource || currentSource === 'Facebook';
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Corrige la source pour un article complet
   * @param {Object} article - Article avec url, source, author
   * @returns {string} - Source corrigée
   */
  correctArticleSource(article) {
    return this.correctSource(
      article.url || article.link,
      article.source,
      article.author
    );
  }

  /**
   * Obtient les statistiques des domaines
   * @returns {Object} - Mapping des domaines supportés
   */
  getSupportedDomains() {
    return { ...this.domainMapping };
  }

  /**
   * Ajoute un nouveau mapping domaine → source
   * @param {string} domain - Nom de domaine
   * @param {string} sourceName - Nom de la source
   */
  addDomainMapping(domain, sourceName) {
    this.domainMapping[domain.toLowerCase()] = sourceName;
  }
}

module.exports = new SourceMediaCorrector();
