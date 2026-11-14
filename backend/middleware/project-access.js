/**
 * Contrôle d'accès aux projets (audit du 2026-11-14).
 *
 * Règle unique, reprise de GET /api/saved-projects/:projectId :
 *   - le propriétaire du projet (saved_projects.user_id) a tous les droits ;
 *   - un collaborateur accepté (project_collaborators.status = 'accepted') peut
 *     lire et contribuer, mais pas administrer le projet (inviter, retirer un
 *     collaborateur, créer un lien de partage) ;
 *   - un administrateur de la plateforme passe partout ;
 *   - tout autre compte est refusé.
 *
 * WHY: être connecté ne suffit pas. Sans ce contrôle, connaître ou deviner
 * l'identifiant d'un projet permettait d'en lire, modifier ou supprimer les
 * documents, notes, fichiers et conversations.
 *
 * @example
 *   // Routes avec :projectId dans l'URL
 *   router.param('projectId', projectParam);
 *   // Routes avec projectId dans le body ou la query
 *   app.use('/api/project-chat', requireProjectScope);
 *   // Ressource adressée par son propre id (document, note...)
 *   if (!(await assertProjectAccess(req, res, doc.project_id))) return;
 */

const supabaseService = require('../supabase-config');
const { requireAuth } = require('./auth');

const PROJECT_ID_KEYS = ['projectId', 'project_id'];

/**
 * Rôle d'un utilisateur sur un projet.
 * @returns {Promise<{exists: boolean, role: 'owner'|'collaborator'|null}>}
 * @throws si la base est indisponible (l'appelant doit refuser l'accès)
 */
async function getProjectAccess(projectId, userId) {
  if (typeof projectId !== 'string' && typeof projectId !== 'number') return { exists: false, role: null };
  const id = String(projectId);
  const { supabase } = supabaseService;

  const { data: project, error } = await supabase
    .from('saved_projects')
    .select('user_id')
    .eq('id', id)
    .maybeSingle();

  // 22P02 = identifiant mal formé (pas un UUID) : projet inexistant, pas une panne.
  if (error && error.code !== '22P02') throw new Error(`Lecture du projet impossible: ${error.message}`);

  if (project) {
    if (project.user_id === userId) return { exists: true, role: 'owner' };

    const { data: collaboration, error: collabError } = await supabase
      .from('project_collaborators')
      .select('id')
      .eq('project_id', id)
      .eq('collaborator_id', userId)
      .eq('status', 'accepted')
      .maybeSingle();
    if (collabError) throw new Error(`Lecture des collaborateurs impossible: ${collabError.message}`);

    return { exists: true, role: collaboration ? 'collaborator' : null };
  }

  // Ancienne table `projects` (encore utilisée par /api/projects/:id/reset).
  // Absente sur certains environnements : toute erreur vaut "projet inconnu".
  try {
    const { data: legacy, error: legacyError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (!legacyError && legacy) {
      return { exists: true, role: legacy.user_id === userId ? 'owner' : null };
    }
  } catch (legacyErr) {
    // Table absente : ignoré
  }

  return { exists: false, role: null };
}

/** Lecture du rôle avec cache sur la requête (un projet = une lecture). */
async function accessFor(req, projectId) {
  const key = String(projectId);
  req._projectAccess = req._projectAccess || new Map();
  if (!req._projectAccess.has(key)) {
    req._projectAccess.set(key, await getProjectAccess(projectId, req.user.id));
  }
  return req._projectAccess.get(key);
}

/**
 * Vérifie l'accès de l'utilisateur authentifié à un projet. En cas de refus,
 * la réponse HTTP est envoyée et la fonction renvoie false.
 *
 * @param {object} options
 * @param {boolean} [options.ownerOnly=false] réserve l'action au propriétaire
 * @returns {Promise<boolean>} true si l'accès est accordé
 */
async function assertProjectAccess(req, res, projectId, { ownerOnly = false } = {}) {
  if (!req.user?.id) {
    res.status(401).json({ success: false, error: 'Token d\'authentification requis', code: 'AUTH_TOKEN_MISSING' });
    return false;
  }
  if (projectId === undefined || projectId === null || projectId === '') {
    res.status(400).json({ success: false, error: 'Identifiant de projet manquant', code: 'PROJECT_ID_MISSING' });
    return false;
  }
  if (req.user.isAdmin === true) return true;

  let access;
  try {
    access = await accessFor(req, projectId);
  } catch (error) {
    console.error('❌ Contrôle d\'accès projet:', error.message);
    res.status(500).json({ success: false, error: 'Erreur de vérification d\'accès', code: 'PROJECT_ACCESS_ERROR' });
    return false;
  }

  if (!access.exists) {
    res.status(404).json({ success: false, error: 'Projet non trouvé', code: 'PROJECT_NOT_FOUND' });
    return false;
  }
  if (!access.role || (ownerOnly && access.role !== 'owner')) {
    res.status(403).json({ success: false, error: 'Accès refusé à ce projet', code: 'PROJECT_ACCESS_DENIED' });
    return false;
  }

  req.projectRole = access.role;
  return true;
}

/** Authentifie si ce n'est pas déjà fait, puis poursuit. */
function withAuth(req, res, next) {
  return req.user?.id && req.authVerified === true ? next() : requireAuth(req, res, next);
}

function collectProjectIds(req) {
  const ids = new Set();
  for (const source of ['body', 'query']) {
    const container = req[source];
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
    for (const key of PROJECT_ID_KEYS) {
      const value = container[key];
      if (value !== undefined && value !== null && value !== '') ids.add(value);
    }
  }
  return Array.from(ids);
}

/**
 * Middleware: tout `projectId` / `project_id` reçu dans le body ou la query doit
 * désigner un projet accessible à l'utilisateur. Sans identifiant de projet, la
 * requête passe telle quelle (les routes publiques ne sont pas affectées).
 *
 * Les corps multipart ne sont pas encore lus à ce stade : les routes d'upload
 * appellent `assertProjectAccess` elles-mêmes.
 */
function requireProjectScope(req, res, next) {
  const ids = collectProjectIds(req);
  if (ids.length === 0) return next();

  return withAuth(req, res, async () => {
    for (const id of ids) {
      if (!(await assertProjectAccess(req, res, id))) return;
    }
    next();
  });
}

function paramGuard(options) {
  return (req, res, next, value) =>
    withAuth(req, res, async () => {
      if (await assertProjectAccess(req, res, value, options)) next();
    });
}

/** Garde pour `router.param('projectId', ...)` : propriétaire ou collaborateur. */
const projectParam = paramGuard({ ownerOnly: false });

/** Garde pour `router.param('projectId', ...)` : propriétaire uniquement. */
const projectOwnerParam = paramGuard({ ownerOnly: true });

module.exports = {
  getProjectAccess,
  assertProjectAccess,
  requireProjectScope,
  projectParam,
  projectOwnerParam,
};
