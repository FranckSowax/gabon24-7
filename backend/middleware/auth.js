const jwt = require('jsonwebtoken');
const supabaseService = require('../supabase-config');

/**
 * Middleware d'authentification JWT
 * Vérifie le token JWT Supabase et extrait les informations utilisateur
 */

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;

/**
 * Extraire le token du header Authorization
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) return null;
  
  // Format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
}

/**
 * Middleware: Authentification requise
 * Vérifie que l'utilisateur est connecté et ajoute req.user
 */
async function requireAuth(req, res, next) {
  try {
    // Déjà authentifié plus haut dans la chaîne (garde global puis routeur) :
    // inutile de réinterroger Supabase. `authVerified` n'est posé que ci-dessous.
    if (req.authVerified === true && req.user?.id) return next();

    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token d\'authentification manquant',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    // Vérifier le token avec Supabase
    const { data: { user }, error } = await supabaseService.supabase.auth.getUser(token);

    if (error || !user) {
      console.warn('❌ Token invalide:', error?.message);
      return res.status(401).json({ 
        success: false,
        error: 'Token invalide ou expiré',
        code: 'AUTH_TOKEN_INVALID'
      });
    }

    // Ajouter les infos utilisateur à la requête
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      metadata: user.user_metadata || {}
    };

    // Récupérer le statut admin depuis la table users si existe
    const { data: userData } = await supabaseService.supabase
      .from('users')
      .select('is_admin, subscription_type')
      .eq('id', user.id)
      .single();

    if (userData) {
      req.user.isAdmin = userData.is_admin === true;
      req.user.subscriptionType = userData.subscription_type;
    }

    req.authVerified = true;
    next();
  } catch (error) {
    console.error('❌ Erreur auth middleware:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware: Authentification optionnelle
 * Ajoute req.user si token présent, sinon continue sans erreur
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      req.user = null;
      return next();
    }

    const { data: { user }, error } = await supabaseService.supabase.auth.getUser(token);

    if (error || !user) {
      req.user = null;
      return next();
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      metadata: user.user_metadata || {}
    };

    // Récupérer le statut admin depuis la table users
    const { data: userData } = await supabaseService.supabase
      .from('users')
      .select('is_admin, subscription_type')
      .eq('id', user.id)
      .single();

    if (userData) {
      req.user.isAdmin = userData.is_admin === true;
      req.user.subscriptionType = userData.subscription_type;
    }

    next();
  } catch (error) {
    console.warn('⚠️ Erreur auth optionnelle:', error.message);
    req.user = null;
    next();
  }
}

/**
 * Middleware: Admin requis
 * Vérifie que l'utilisateur est admin
 */
async function requireAdmin(req, res, next) {
  try {
    // D'abord vérifier l'authentification
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token d\'authentification manquant',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    const { data: { user }, error } = await supabaseService.supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        success: false,
        error: 'Token invalide ou expiré',
        code: 'AUTH_TOKEN_INVALID'
      });
    }

    // Vérifier le statut admin dans la table users
    const { data: userData, error: userError } = await supabaseService.supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.is_admin === true;

    if (!isAdmin) {
      console.warn(`⚠️ Accès admin refusé pour: ${user.email}`);
      return res.status(403).json({ 
        success: false,
        error: 'Accès réservé aux administrateurs',
        code: 'AUTH_ADMIN_REQUIRED'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: 'admin',
      isAdmin: true,
      metadata: user.user_metadata || {}
    };

    console.log(`✅ Accès admin autorisé: ${user.email}`);
    next();
  } catch (error) {
    console.error('❌ Erreur admin middleware:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Erreur de vérification admin',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware factory: Vérifier un rôle spécifique
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const token = extractToken(req);
      
      if (!token) {
        return res.status(401).json({ 
          success: false,
          error: 'Token d\'authentification manquant',
          code: 'AUTH_TOKEN_MISSING'
        });
      }

      const { data: { user }, error } = await supabaseService.supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ 
          success: false,
          error: 'Token invalide ou expiré',
          code: 'AUTH_TOKEN_INVALID'
        });
      }

      // Récupérer le statut admin
      const { data: userData } = await supabaseService.supabase
        .from('users')
        .select('is_admin, subscription_type')
        .eq('id', user.id)
        .single();

      const userRole = userData?.is_admin ? 'admin' : (userData?.subscription_type || 'user');

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: `Rôle requis: ${allowedRoles.join(' ou ')}`,
          code: 'AUTH_ROLE_REQUIRED'
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: userRole,
        isAdmin: userData?.is_admin === true,
        metadata: user.user_metadata || {}
      };

      next();
    } catch (error) {
      console.error('❌ Erreur role middleware:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Erreur de vérification de rôle',
        code: 'AUTH_ERROR'
      });
    }
  };
}

// ============================================================
// Gardes d'identité et de déclenchement (audit du 2026-11-14)
// ============================================================

const crypto = require('crypto');

const USER_ID_KEYS = ['userId', 'user_id'];

// Jeton propre à ce processus, régénéré à chaque démarrage et jamais exposé.
// Il authentifie les appels que le serveur se fait à lui-même (crons internes
// via http://localhost), sans dépendre d'une variable d'environnement.
const INTERNAL_CALL_TOKEN = crypto.randomBytes(32).toString('hex');

/** Comparaison en temps constant de deux secrets (longueurs quelconques). */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Vrai si l'utilisateur authentifié est admin (lu en base, mis en cache sur la requête). */
async function isAdminUser(req) {
  if (!req.user) return false;
  if (req.user.isAdmin === true) return true;
  if (req.user._adminChecked) return false;
  req.user._adminChecked = true;
  try {
    const { data } = await supabaseService.supabase
      .from('users')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();
    req.user.isAdmin = data?.is_admin === true;
  } catch (error) {
    req.user.isAdmin = false;
  }
  return req.user.isAdmin;
}

/**
 * Middleware: l'utilisateur ne peut agir que sur son propre compte.
 *
 * Exige un JWT valide, puis contrôle tout `userId` / `user_id` reçu dans le body
 * ou la query :
 *   - différent de l'identité du jeton -> 403 (sauf administrateur) ;
 *   - identique ou absent              -> la requête passe telle quelle.
 * Rien n'est injecté dans la requête : les handlers existants restent inchangés.
 * Les paramètres d'URL (:userId, :user_id) sont couverts par `ownUserParam`.
 *
 * @example
 *   app.use('/api/reading-history', requireOwnUser, readingHistoryRouter);
 */
function requireOwnUser(req, res, next) {
  return requireAuth(req, res, async () => {
    try {
      for (const source of ['body', 'query']) {
        const container = req[source];
        if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
        for (const key of USER_ID_KEYS) {
          const value = container[key];
          if (value === undefined || value === null || value === '') continue;
          if (String(value) !== req.user.id && !(await isAdminUser(req))) {
            return res.status(403).json({
              success: false,
              error: 'Accès refusé',
              code: 'AUTH_USER_MISMATCH'
            });
          }
        }
      }

      next();
    } catch (error) {
      console.error('❌ Erreur requireOwnUser:', error.message);
      return res.status(500).json({ success: false, error: 'Erreur d\'authentification', code: 'AUTH_ERROR' });
    }
  });
}

/**
 * Garde pour les paramètres d'URL désignant un utilisateur.
 * À brancher dans un routeur déjà protégé par requireAuth / requireOwnUser.
 *
 * @example
 *   router.param('userId', ownUserParam);
 */
async function ownUserParam(req, res, next, value) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Token d\'authentification requis', code: 'AUTH_TOKEN_MISSING' });
  }
  if (String(value) !== req.user.id && !(await isAdminUser(req))) {
    return res.status(403).json({ success: false, error: 'Accès refusé', code: 'AUTH_USER_MISMATCH' });
  }
  next();
}

/**
 * Middleware: route déclencheuse (RSS, alertes, extraction...) réservée aux
 * tâches planifiées et aux administrateurs.
 *
 * Accepte l'en-tête `X-Cron-Secret` égal à CRON_SECRET, le jeton interne du
 * processus (`X-Internal-Token`, appels du serveur à lui-même) ou un JWT admin.
 * Si CRON_SECRET n'est pas configuré, seule la voie admin fonctionne : les crons
 * Netlify / GitHub Actions doivent donc envoyer ce secret.
 */
function requireCronOrAdmin(req, res, next) {
  const expected = process.env.CRON_SECRET;
  const received = req.headers['x-cron-secret'];
  if (expected && typeof received === 'string' && received.length > 0 && safeEqual(received, expected)) {
    req.isCron = true;
    return next();
  }
  const internal = req.headers['x-internal-token'];
  if (typeof internal === 'string' && internal.length > 0 && safeEqual(internal, INTERNAL_CALL_TOKEN)) {
    req.isCron = true;
    return next();
  }
  return requireAdmin(req, res, next);
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireRole,
  requireOwnUser,
  ownUserParam,
  requireCronOrAdmin,
  INTERNAL_CALL_TOKEN,
  extractToken
};
