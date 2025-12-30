const { requireAuth, requireAdmin, optionalAuth } = require('../../middleware/auth');
const jwt = require('jsonwebtoken');

// Mock JWT
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('devrait autoriser avec un token valide', () => {
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify = jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'authenticated'
      });

      requireAuth(req, res, next);

      expect(req.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        role: 'authenticated'
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('devrait rejeter sans token', () => {
      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Token manquant'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait rejeter avec un token invalide', () => {
      req.headers.authorization = 'Bearer invalid-token';
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('devrait autoriser un admin', () => {
      req.headers.authorization = 'Bearer admin-token';
      jwt.verify = jest.fn().mockReturnValue({
        sub: 'admin-123',
        email: 'admin@example.com',
        role: 'authenticated',
        user_metadata: { is_admin: true }
      });

      requireAdmin(req, res, next);

      expect(req.user.isAdmin).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('devrait rejeter un non-admin', () => {
      req.headers.authorization = 'Bearer user-token';
      jwt.verify = jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'user@example.com',
        role: 'authenticated',
        user_metadata: { is_admin: false }
      });

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Accès refusé - Admin requis'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('devrait extraire le user si token présent', () => {
      req.headers.authorization = 'Bearer valid-token';
      jwt.verify = jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'user@example.com'
      });

      optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-123');
      expect(next).toHaveBeenCalled();
    });

    it('devrait continuer sans user si pas de token', () => {
      optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
