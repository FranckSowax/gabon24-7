/**
 * Contrôle d'accès aux projets : être connecté ne suffit pas, il faut être
 * propriétaire du projet ou collaborateur accepté.
 *
 * Les vrais routeurs sont montés derrière les mêmes gardes que dans server.js,
 * sur une base Supabase simulée en mémoire.
 */

const express = require('express');
const request = require('supertest');

const OWNER = '11111111-1111-4111-8111-111111111111';
const COLLAB = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const ADMIN = '44444444-4444-4444-8444-444444444444';
const INVITED = '55555555-5555-4555-8555-555555555555';
const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_PROJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UNKNOWN_PROJECT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const mockDb = {};
let mockSeq = 0;

jest.mock('../../supabase-config', () => {
  const table = (name) => {
    const filters = [];
    let op = 'select';
    let payload = null;
    const rows = () => (mockDb[name] = mockDb[name] || []);
    const match = (row) => filters.every(([key, value]) => String(row[key]) === String(value));
    const run = () => {
      if (op === 'insert') {
        const items = [].concat(payload).map((item) => ({ id: `gen-${++mockSeq}`, ...item }));
        rows().push(...items);
        return { data: items, error: null };
      }
      const hits = rows().filter(match);
      if (op === 'update') hits.forEach((row) => Object.assign(row, payload));
      if (op === 'delete') mockDb[name] = rows().filter((row) => !match(row));
      return { data: hits, error: null };
    };
    const builder = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      in: () => builder,
      eq: (key, value) => { filters.push([key, value]); return builder; },
      insert: (value) => { op = 'insert'; payload = value; return builder; },
      update: (value) => { op = 'update'; payload = value; return builder; },
      delete: () => { op = 'delete'; return builder; },
      maybeSingle: async () => ({ data: run().data[0] || null, error: null }),
      single: async () => {
        const first = run().data[0];
        return first ? { data: first, error: null } : { data: null, error: { message: 'no rows' } };
      },
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  };

  return {
    supabase: {
      from: (name) => table(name),
      storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
      auth: {
        getUser: async (token) => {
          const match = /^token-(.+)$/.exec(token || '');
          if (!match) return { data: { user: null }, error: { message: 'invalid' } };
          return { data: { user: { id: match[1], email: `${match[1]}@example.com` } }, error: null };
        },
      },
    },
  };
});

jest.mock('../../services/gemini-service', () => ({}));
jest.mock('../../services/emailService', () => ({
  sendCollaboratorInvitation: jest.fn().mockResolvedValue(undefined),
  sendCommentNotification: jest.fn().mockResolvedValue(undefined),
  sendDocumentNotification: jest.fn().mockResolvedValue(undefined),
  sendInvitationAcceptedNotification: jest.fn().mockResolvedValue(undefined),
}));

const { requireOwnUser } = require('../../middleware/auth');
const { requireProjectScope, getProjectAccess } = require('../../middleware/project-access');

// Même montage que server.js (bloc "GARDES D'ACCÈS")
const app = express();
app.use(express.json());
['/api/project-documents', '/api/project-timeline', '/api/project-actions']
  .forEach((path) => app.use(path, requireOwnUser));
['/api/project-documents', '/api/project-timeline', '/api/project-notes', '/api/project-actions', '/api/project-collaboration']
  .forEach((path) => app.use(path, requireProjectScope));
app.use('/api/project-documents', require('../../src/routes/project-documents'));
app.use('/api/project-timeline', require('../../src/routes/project-timeline'));
app.use('/api/project-notes', require('../../routes/project-notes'));
app.use('/api/project-actions', require('../../routes/project-actions'));
app.use('/api/project-collaboration', require('../../src/routes/project-collaboration'));

const as = (userId) => ({ Authorization: `Bearer token-${userId}` });
const call = (method, url, userId, body) => {
  const req = request(app)[method](url);
  if (userId) req.set(as(userId));
  return body ? req.send(body) : req;
};

beforeEach(() => {
  for (const key of Object.keys(mockDb)) delete mockDb[key];
  Object.assign(mockDb, {
    users: [{ id: ADMIN, is_admin: true }, { id: OWNER, is_admin: false }],
    saved_projects: [
      { id: PROJECT, user_id: OWNER, title: 'Projet du propriétaire' },
      { id: OTHER_PROJECT, user_id: STRANGER, title: 'Projet de l\'inconnu' },
    ],
    project_collaborators: [
      { id: 'collab-1', project_id: PROJECT, owner_id: OWNER, collaborator_id: COLLAB, collaborator_email: `${COLLAB}@example.com`, status: 'accepted' },
      { id: 'invite-1', project_id: PROJECT, owner_id: OWNER, collaborator_id: null, collaborator_email: `${INVITED}@EXAMPLE.com`, status: 'pending' },
    ],
    project_documents: [{ id: 'doc-1', project_id: PROJECT, user_id: OWNER, title: 'Plan', content: 'confidentiel' }],
    project_notes: [{ id: 'note-1', project_id: PROJECT, user_id: OWNER, note_content: 'note privée' }],
    project_timeline: [{ id: 'entry-1', project_id: PROJECT, entry_type: 'event', reference_id: null }],
    project_actions: [{ id: 'action-1', project_id: PROJECT, user_id: OWNER, action_status: 'pending' }],
  });
});

describe('getProjectAccess', () => {
  it.each([
    ['le propriétaire', OWNER, { exists: true, role: 'owner' }],
    ['un collaborateur accepté', COLLAB, { exists: true, role: 'collaborator' }],
    ['un invité qui n\'a pas encore accepté', INVITED, { exists: true, role: null }],
    ['un inconnu', STRANGER, { exists: true, role: null }],
  ])('pour %s', async (label, userId, expected) => {
    expect(await getProjectAccess(PROJECT, userId)).toEqual(expected);
  });

  it('signale un projet inexistant', async () => {
    expect(await getProjectAccess(UNKNOWN_PROJECT, OWNER)).toEqual({ exists: false, role: null });
  });
});

describe('lecture par :projectId', () => {
  const urls = [
    `/api/project-documents/project/${PROJECT}`,
    `/api/project-notes/${PROJECT}`,
    `/api/project-timeline/${PROJECT}`,
    `/api/project-actions/${PROJECT}`,
    `/api/project-collaboration/list/${PROJECT}`,
    `/api/project-collaboration/comments/${PROJECT}`,
    `/api/project-collaboration/documents/${PROJECT}`,
  ];

  it.each(urls)('%s : refusé sans jeton', async (url) => {
    expect((await call('get', url)).status).toBe(401);
  });

  it.each(urls)('%s : refusé à un inconnu connecté', async (url) => {
    const res = await call('get', url, STRANGER);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROJECT_ACCESS_DENIED');
  });

  it.each(urls)('%s : accordé au propriétaire, au collaborateur et à l\'admin', async (url) => {
    for (const userId of [OWNER, COLLAB, ADMIN]) {
      expect((await call('get', url, userId)).status).toBe(200);
    }
  });

  it('répond 404 pour un projet inexistant', async () => {
    const res = await call('get', `/api/project-notes/${UNKNOWN_PROJECT}`, OWNER);
    expect(res.status).toBe(404);
  });
});

describe('documents adressés par leur id', () => {
  it('un inconnu ne peut ni lire ni modifier le document d\'un autre', async () => {
    const read = await call('get', '/api/project-documents/doc-1', STRANGER);
    const write = await call('put', '/api/project-documents/doc-1', STRANGER, { content: 'piraté' });

    expect(read.status).toBe(403);
    expect(read.body.document).toBeUndefined();
    expect(write.status).toBe(403);
    expect(mockDb.project_documents[0].content).toBe('confidentiel');
  });

  it('un inconnu ne peut pas supprimer le document d\'un autre', async () => {
    await call('delete', '/api/project-documents/doc-1', STRANGER);
    const spoofed = await call('delete', `/api/project-documents/doc-1?userId=${OWNER}`, STRANGER);

    expect(spoofed.status).toBe(403);
    expect(mockDb.project_documents).toHaveLength(1);
  });

  it('le propriétaire et le collaborateur lisent le document', async () => {
    expect((await call('get', '/api/project-documents/doc-1', OWNER)).status).toBe(200);
    expect((await call('get', '/api/project-documents/doc-1', COLLAB)).status).toBe(200);
  });

  it('un inconnu ne peut pas créer un document dans le projet d\'un autre', async () => {
    const res = await call('post', '/api/project-documents', STRANGER, {
      projectId: PROJECT, userId: STRANGER, documentType: 'note', title: 'x', content: 'y',
    });

    expect(res.status).toBe(403);
    expect(mockDb.project_documents).toHaveLength(1);
  });
});

describe('écritures dans un projet', () => {
  it('un inconnu ne peut pas ajouter de note ; un collaborateur le peut', async () => {
    const body = { projectId: PROJECT, noteContent: 'bonjour' };

    expect((await call('post', '/api/project-notes', STRANGER, body)).status).toBe(403);
    expect(mockDb.project_notes).toHaveLength(1);

    expect((await call('post', '/api/project-notes', COLLAB, body)).status).toBe(200);
    expect(mockDb.project_notes).toHaveLength(2);
  });

  it('un inconnu ne peut pas supprimer une entrée de chronologie', async () => {
    const res = await call('delete', '/api/project-timeline/entry-1', STRANGER);

    expect(res.status).toBe(403);
    expect(mockDb.project_timeline).toHaveLength(1);
  });

  it('le propriétaire supprime une entrée de chronologie', async () => {
    const res = await call('delete', '/api/project-timeline/entry-1', OWNER);

    expect(res.status).toBe(200);
    expect(mockDb.project_timeline).toHaveLength(0);
  });

  it('un inconnu ne peut pas changer le statut d\'une action', async () => {
    const res = await call('patch', '/api/project-actions/action-1/status', STRANGER, { status: 'completed' });

    expect(res.status).toBe(403);
    expect(mockDb.project_actions[0].action_status).toBe('pending');
  });

  it('un inconnu ne peut pas lire le résumé d\'actions d\'un autre utilisateur', async () => {
    expect((await call('get', `/api/project-actions/user/${OWNER}/summary`, STRANGER)).status).toBe(403);
  });
});

describe('collaboration', () => {
  it('un inconnu ne peut pas s\'inviter dans le projet d\'un autre', async () => {
    const res = await call('post', '/api/project-collaboration/invite', STRANGER, {
      projectId: PROJECT, ownerId: STRANGER, collaboratorEmail: `${STRANGER}@example.com`, role: 'editor',
    });

    expect(res.status).toBe(403);
    expect(mockDb.project_collaborators).toHaveLength(2);
  });

  it('un collaborateur ne peut ni inviter ni créer de lien de partage', async () => {
    const invite = await call('post', '/api/project-collaboration/invite', COLLAB, {
      projectId: PROJECT, ownerId: COLLAB, collaboratorEmail: 'ami@example.com',
    });
    const link = await call('post', '/api/project-collaboration/generate-share-link', COLLAB, {
      projectId: PROJECT, ownerId: COLLAB,
    });

    expect(invite.status).toBe(403);
    expect(link.status).toBe(403);
    expect(mockDb.project_share_links || []).toHaveLength(0);
  });

  it('un inconnu ne peut pas obtenir de lien de partage, même en se disant propriétaire', async () => {
    const res = await call('post', '/api/project-collaboration/generate-share-link', STRANGER, {
      projectId: PROJECT, ownerId: OWNER,
    });

    expect(res.status).toBe(403);
    expect(mockDb.project_share_links || []).toHaveLength(0);
  });

  it('un inconnu ne peut pas accepter l\'invitation d\'un autre', async () => {
    const res = await call('post', '/api/project-collaboration/accept', STRANGER, {
      collaboratorId: 'invite-1', userId: STRANGER,
    });

    expect(res.status).toBe(403);
    expect(mockDb.project_collaborators[1]).toEqual(expect.objectContaining({ status: 'pending', collaborator_id: null }));
  });

  it('la personne invitée accepte son invitation (adresse e-mail insensible à la casse)', async () => {
    const res = await call('post', '/api/project-collaboration/accept', INVITED, {
      collaboratorId: 'invite-1', userId: INVITED,
    });

    expect(res.status).toBe(200);
    expect(mockDb.project_collaborators[1]).toEqual(expect.objectContaining({ status: 'accepted', collaborator_id: INVITED }));
  });

  it('un inconnu ne peut pas refuser l\'invitation d\'un autre', async () => {
    const res = await call('post', '/api/project-collaboration/reject', STRANGER, { collaboratorId: 'invite-1' });

    expect(res.status).toBe(403);
    expect(mockDb.project_collaborators[1].status).toBe('pending');
  });

  it('seuls le propriétaire et l\'intéressé retirent un collaborateur', async () => {
    expect((await call('delete', '/api/project-collaboration/remove/collab-1', STRANGER)).status).toBe(403);
    expect(mockDb.project_collaborators).toHaveLength(2);

    expect((await call('delete', '/api/project-collaboration/remove/collab-1', COLLAB)).status).toBe(200);
    expect(mockDb.project_collaborators).toHaveLength(1);

    expect((await call('delete', '/api/project-collaboration/remove/invite-1', OWNER)).status).toBe(200);
    expect(mockDb.project_collaborators).toHaveLength(0);
  });

  it('un inconnu ne peut pas commenter le projet d\'un autre ni usurper un auteur', async () => {
    const outsider = await call('post', '/api/project-collaboration/comment', STRANGER, {
      projectId: PROJECT, userId: STRANGER, content: 'spam',
    });
    const spoofed = await call('post', '/api/project-collaboration/comment', COLLAB, {
      projectId: PROJECT, userId: OWNER, content: 'au nom du propriétaire',
    });

    expect(outsider.status).toBe(403);
    expect(spoofed.status).toBe(403);
    expect(mockDb.project_collaboration_comments || []).toHaveLength(0);
  });

  it('un inconnu ne peut pas lister les projets partagés avec un autre', async () => {
    expect((await call('get', `/api/project-collaboration/shared-with-me/${COLLAB}`, STRANGER)).status).toBe(403);
    expect((await call('get', `/api/project-collaboration/shared-with-me/${COLLAB}`, COLLAB)).status).toBe(200);
  });

  it('la page publique d\'une invitation reste accessible sans jeton', async () => {
    const res = await call('get', '/api/project-collaboration/invitation/invite-1');

    expect([401, 403]).not.toContain(res.status);
  });
});
