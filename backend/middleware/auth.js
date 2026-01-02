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

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireRole,
  extractToken
};
