import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Interface pour étendre Request avec user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone_number: string;
    subscription_tier: 'free' | 'premium' | 'journalist';
    subscription_status: 'active' | 'inactive' | 'suspended';
  };
}

/**
 * Middleware de vérification des rôles
 */
export function roleMiddleware(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentification requise'
        });
      }

      const userRole = getUserRole(req.user.subscription_tier, req.user.subscription_status);

      if (!allowedRoles.includes(userRole)) {
        logger.warn(`Accès refusé pour l'utilisateur ${req.user.id}`, {
          userRole,
          allowedRoles,
          endpoint: req.path
        });

        return res.status(403).json({
          success: false,
          error: 'Permissions insuffisantes',
          required: allowedRoles,
          current: userRole
        });
      }

      // Ajouter le rôle à la requête pour usage ultérieur
      (req as any).userRole = userRole;
      
      next();

    } catch (error) {
      logger.error('Erreur dans le middleware de rôle:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
      });
    }
  };
}

/**
 * Déterminer le rôle d'un utilisateur basé sur son abonnement
 */
function getUserRole(subscriptionTier: string, subscriptionStatus: string): string {
  // Utilisateur suspendu = accès limité
  if (subscriptionStatus === 'suspended') {
    return 'suspended';
  }

  // Utilisateur inactif = accès gratuit seulement
  if (subscriptionStatus === 'inactive') {
    return 'free';
  }

  // Mapper les tiers d'abonnement aux rôles
  switch (subscriptionTier) {
    case 'journalist':
      return 'journalist';
    case 'premium':
      return 'premium';
    case 'free':
    default:
      return 'free';
  }
}

/**
 * Middleware pour vérifier si l'utilisateur est administrateur
 */
export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return roleMiddleware(['admin'])(req, res, next);
}

/**
 * Middleware pour vérifier si l'utilisateur est journaliste ou admin
 */
export function journalistOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return roleMiddleware(['journalist', 'admin'])(req, res, next);
}

/**
 * Middleware pour vérifier si l'utilisateur a un abonnement premium ou plus
 */
export function premiumOrHigher(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  return roleMiddleware(['premium', 'journalist', 'admin'])(req, res, next);
}
