/**
 * 📅 UTILITAIRES POUR LE TEMPS RELATIF
 */

/**
 * Formatte une date en temps relatif (ex: "il y a 2 heures")
 * @param {string|Date} date - Date à formater
 * @returns {string} - Temps relatif en français
 */
function formatTimeAgo(date) {
  if (!date) return 'Date inconnue';
  
  try {
    const now = new Date();
    const past = new Date(date);
    
    // Vérifier que la date est valide
    if (isNaN(past.getTime())) {
      return 'Date invalide';
    }
    
    const diffMs = now - past;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    // Futur (si la date est dans le futur)
    if (diffMs < 0) {
      return 'À venir';
    }
    
    // Moins d'une minute
    if (diffSeconds < 60) {
      return 'À l\'instant';
    }
    
    // Minutes
    if (diffMinutes < 60) {
      return diffMinutes === 1 
        ? 'il y a 1 minute' 
        : `il y a ${diffMinutes} minutes`;
    }
    
    // Heures
    if (diffHours < 24) {
      return diffHours === 1 
        ? 'il y a 1 heure' 
        : `il y a ${diffHours} heures`;
    }
    
    // Jours
    if (diffDays < 7) {
      return diffDays === 1 
        ? 'il y a 1 jour' 
        : `il y a ${diffDays} jours`;
    }
    
    // Semaines
    if (diffWeeks < 5) {
      return diffWeeks === 1 
        ? 'il y a 1 semaine' 
        : `il y a ${diffWeeks} semaines`;
    }
    
    // Mois
    if (diffMonths < 12) {
      return diffMonths === 1 
        ? 'il y a 1 mois' 
        : `il y a ${diffMonths} mois`;
    }
    
    // Années
    return diffYears === 1 
      ? 'il y a 1 an' 
      : `il y a ${diffYears} ans`;
      
  } catch (error) {
    console.error('❌ Erreur formatTimeAgo:', error);
    return 'Date invalide';
  }
}

/**
 * Formatte une date complète (ex: "1 octobre 2025, 14:30")
 * @param {string|Date} date - Date à formater
 * @returns {string} - Date formatée en français
 */
function formatFullDate(date) {
  if (!date) return 'Date inconnue';
  
  try {
    const d = new Date(date);
    
    if (isNaN(d.getTime())) {
      return 'Date invalide';
    }
    
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return d.toLocaleDateString('fr-FR', options);
  } catch (error) {
    return 'Date invalide';
  }
}

/**
 * Calcule si un article est dans une plage temporelle donnée
 * @param {string|Date} publishedAt - Date de publication
 * @param {string} range - Plage: 'today' (0-36h), 'week' (36h-7j), 'archives' (>7j)
 * @returns {boolean}
 */
function isInTimeRange(publishedAt, range) {
  if (!publishedAt) return false;
  
  try {
    const now = new Date();
    const published = new Date(publishedAt);
    
    if (isNaN(published.getTime())) {
      return false;
    }
    
    const diffMs = now - published;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;
    
    switch (range) {
      case 'today':
        // 0 à 36 heures
        return diffHours >= 0 && diffHours <= 36;
        
      case 'week':
        // 36 heures à 7 jours
        return diffHours > 36 && diffDays <= 7;
        
      case 'archives':
        // Plus de 7 jours
        return diffDays > 7;
        
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Obtient les timestamps pour une plage temporelle
 * @param {string} range - Plage: 'today', 'week', 'archives'
 * @returns {Object} - {start: Date, end: Date}
 */
function getTimeRangeTimestamps(range) {
  const now = new Date();
  
  switch (range) {
    case 'today':
      // 0 à 36 heures
      return {
        start: new Date(now.getTime() - 36 * 60 * 60 * 1000),
        end: now
      };
      
    case 'week':
      // 36 heures à 7 jours
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() - 36 * 60 * 60 * 1000)
      };
      
    case 'archives':
      // Plus de 7 jours (jusqu'à 1 an en arrière)
      return {
        start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      };
      
    default:
      return {
        start: new Date(0),
        end: now
      };
  }
}

module.exports = {
  formatTimeAgo,
  formatFullDate,
  isInTimeRange,
  getTimeRangeTimestamps
};
