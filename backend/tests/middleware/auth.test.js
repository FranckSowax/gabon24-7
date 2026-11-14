/**
 * Tests du middleware d'authentification.
 *
 * Le jeton est vérifié auprès de Supabase (`auth.getUser`), puis le statut admin
 * est lu dans la table `users`. Les deux sont simulés ici.
 */

const mockGetUser = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../supabase-config', () => {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: (...args) => mockSingle(...args),
  };
  return {
    supabase: {
      from: jest.fn(() => builder),
      auth: { getUser: (...args) => mockGetUser(...args) },
    },
  };
});

const {
  requireAuth,
  requireAdmin,
  optionalAuth,
  requireRole,
  extractToken,
} = require('../../middleware/auth');

const validUser = (overrides = {}) => ({
  data: { user: { id: 'user-123', email: 'user@example.com', role: 'authenticated', ...overrides } },
  error: null,
});
const invalidToken = () => ({ data: { user: null }, error: { message: 'invalid JWT' } });
const profile = (row) => ({ data: row, error: null });

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, user: null };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  describe('extractToken', () => {
    it('extrait le jeton d\'un en-tête Bearer', () => {
      expect(extractToken({ headers: { authorization: 'Bearer abc' } })).toBe('abc');
    });

    it.each([undefined, 'abc', 'Basic abc', 'Bearer a b'])('refuse l\'en-tête %p', (authorization) => {
      expect(extractToken({ headers: { authorization } })).toBeNull();
    });
  });

  describe('requireAuth', () => {
    it('devrait autoriser avec un token valide', async () => {
      req.headers.authorization = 'Bearer valid-token';
      mockGetUser.mockResolvedValue(validUser());
      mockSingle.mockResolvedValue(profile({ is_admin: false, subscription_type: 'premium' }));

      await requireAuth(req, res, next);

      expect(mockGetUser).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual({
        id: 'user-123',
        email: 'user@example.com',
        role: 'authenticated',
        metadata: {},
        isAdmin: false,
        subscriptionType: 'premium',
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('ne se fie pas aux métadonnées du jeton pour le statut admin', async () => {
      req.headers.authorization = 'Bearer valid-token';
      mockGetUser.mockResolvedValue(validUser({ user_metadata: { is_admin: true } }));
      mockSingle.mockResolvedValue(profile({ is_admin: false, subscription_type: 'free' }));

      await requireAuth(req, res, next);

      expect(req.user.isAdmin).toBe(false);
    });

    it('devrait rejeter sans token', async () => {
      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, code: 'AUTH_TOKEN_MISSING' }));
      expect(mockGetUser).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait rejeter avec un token invalide', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      mockGetUser.mockResolvedValue(invalidToken());

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }));
      expect(req.user).toBeNull();
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait répondre 500 sans laisser passer si Supabase est en panne', async () => {
      req.headers.authorization = 'Bearer valid-token';
      mockGetUser.mockRejectedValue(new Error('réseau indisponible'));

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('devrait autoriser un admin', async () => {
      req.headers.authorization = 'Bearer admin-token';
      mockGetUser.mockResolvedValue(validUser({ id: 'admin-123', email: 'admin@example.com' }));
      mockSingle.mockResolvedValue(profile({ is_admin: true }));

      await requireAdmin(req, res, next);

      expect(req.user.isAdmin).toBe(true);
      expect(req.user.id).toBe('admin-123');
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('devrait rejeter un non-admin', async () => {
      req.headers.authorization = 'Bearer user-token';
      mockGetUser.mockResolvedValue(validUser());
      mockSingle.mockResolvedValue(profile({ is_admin: false }));

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_ADMIN_REQUIRED' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait rejeter un admin autoproclamé dans les métadonnées du jeton', async () => {
      req.headers.authorization = 'Bearer user-token';
      mockGetUser.mockResolvedValue(validUser({ user_metadata: { is_admin: true } }));
      mockSingle.mockResolvedValue(profile({ is_admin: false }));

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait rejeter si le profil est introuvable en base', async () => {
      req.headers.authorization = 'Bearer user-token';
      mockGetUser.mockResolvedValue(validUser());
      mockSingle.mockResolvedValue({ data: null, error: { message: 'no rows' } });

      await requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait rejeter sans token, puis avec un token invalide', async () => {
      await requireAdmin(req, res, next);
      expect(res.status).toHaveBeenLastCalledWith(401);

      req.headers.authorization = 'Bearer invalid-token';
      mockGetUser.mockResolvedValue(invalidToken());
      await requireAdmin(req, res, next);
      expect(res.status).toHaveBeenLastCalledWith(401);

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('devrait extraire le user si token présent', async () => {
      req.headers.authorization = 'Bearer valid-token';
      mockGetUser.mockResolvedValue(validUser());
      mockSingle.mockResolvedValue(profile({ is_admin: false, subscription_type: 'free' }));

      await optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-123');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('devrait continuer sans user si pas de token', async () => {
      await optionalAuth(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('devrait continuer sans user si le token est invalide ou si Supabase échoue', async () => {
      req.headers.authorization = 'Bearer invalid-token';
      mockGetUser.mockResolvedValueOnce(invalidToken());
      await optionalAuth(req, res, next);
      expect(req.user).toBeNull();

      mockGetUser.mockRejectedValueOnce(new Error('réseau indisponible'));
      await optionalAuth(req, res, next);
      expect(req.user).toBeNull();

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('autorise un rôle listé et refuse les autres', async () => {
      req.headers.authorization = 'Bearer valid-token';
      mockGetUser.mockResolvedValue(validUser());

      mockSingle.mockResolvedValueOnce(profile({ is_admin: false, subscription_type: 'premium' }));
      await requireRole('premium', 'admin')(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user.role).toBe('premium');

      mockSingle.mockResolvedValueOnce(profile({ is_admin: false, subscription_type: 'free' }));
      await requireRole('premium', 'admin')(req, res, next);
      expect(res.status).toHaveBeenLastCalledWith(403);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
