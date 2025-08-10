import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/database';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone_number: string;
    subscription_tier: 'free' | 'premium' | 'journalist';
    subscription_status: 'active' | 'inactive' | 'suspended';
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET manquant dans les variables d\'environnement');
      return res.status(500).json({
        success: false,
        error: 'Configuration serveur invalide'
      });
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        error: 'Token invalide'
      });
    }

    // Récupérer les informations utilisateur depuis la base de données
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, phone_number, subscription_tier, subscription_status')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      logger.warn(`Utilisateur non trouvé pour le token: ${decoded.userId}`);
      return res.status(401).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Vérifier si l'utilisateur est suspendu
    if (user.subscription_status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Compte suspendu'
      });
    }

    // Ajouter l'utilisateur à la requête
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token invalide'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expiré'
      });
    }

    logger.error('Erreur dans le middleware d\'authentification:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
}
