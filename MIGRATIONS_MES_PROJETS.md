# 🔧 Migrations SQL - Mes Projets

## ⚠️ Erreur actuelle
```
Could not find the table 'public.saved_proposals' in the schema cache
Could not find the table 'public.saved_documents' in the schema cache
```

## 📋 Migrations à exécuter dans Supabase

### Étape 1: Ouvrir l'éditeur SQL
👉 https://supabase.com/dashboard/project/fxyfbkmqbjijbvpdxbdh/sql/new

---

### Étape 2: Migration `saved_proposals`

**Copie-colle ce SQL et clique sur "Run":**

```sql
-- Migration: Création table saved_proposals pour "Mes Projets"

CREATE TABLE IF NOT EXISTS saved_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  proposal_data JSONB NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  budget TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_proposals_user_id ON saved_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_proposals_created_at ON saved_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_proposals_status ON saved_proposals(status);
CREATE INDEX IF NOT EXISTS idx_saved_proposals_article_id ON saved_proposals(article_id);

ALTER TABLE saved_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own proposals" ON saved_proposals;
DROP POLICY IF EXISTS "Users can create their own proposals" ON saved_proposals;
DROP POLICY IF EXISTS "Users can update their own proposals" ON saved_proposals;
DROP POLICY IF EXISTS "Users can delete their own proposals" ON saved_proposals;

CREATE POLICY "Users can view their own proposals"
  ON saved_proposals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proposals"
  ON saved_proposals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proposals"
  ON saved_proposals FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proposals"
  ON saved_proposals FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_saved_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_proposals_updated_at_trigger ON saved_proposals;

CREATE TRIGGER update_saved_proposals_updated_at_trigger
  BEFORE UPDATE ON saved_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_proposals_updated_at();
```

---

### Étape 3: Migration `saved_documents`

**Nouvelle requête SQL, copie-colle et clique sur "Run":**

```sql
-- Migration: Création table saved_documents pour "Mes Projets"

CREATE TABLE IF NOT EXISTS saved_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('business_plan', 'pitch_deck', 'financial_projection', 'market_study', 'other')),
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  file_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'archived')),
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_documents_user_id ON saved_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_documents_created_at ON saved_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_documents_type ON saved_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_saved_documents_status ON saved_documents(status);

ALTER TABLE saved_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own documents" ON saved_documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON saved_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON saved_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON saved_documents;

CREATE POLICY "Users can view their own documents"
  ON saved_documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents"
  ON saved_documents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON saved_documents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON saved_documents FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_saved_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_documents_updated_at_trigger ON saved_documents;

CREATE TRIGGER update_saved_documents_updated_at_trigger
  BEFORE UPDATE ON saved_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_documents_updated_at();
```

---

## ✅ Vérification

Après avoir exécuté les 2 migrations:

1. **Va dans Table Editor** dans Supabase
2. **Vérifie que tu vois:**
   - ✅ Table `saved_proposals`
   - ✅ Table `saved_documents`

3. **Rafraîchis la page "Mes Projets"** dans le frontend
4. **La console devrait être propre** (plus d'erreurs 500)

---

## 📊 Structure des tables

### `saved_proposals`
- Stocke les propositions business sauvegardées
- Lien avec articles (optionnel)
- Statut: active, archived, completed
- Données complètes en JSONB

### `saved_documents`
- Stocke les documents générés (business plans, pitch decks, etc.)
- Types: business_plan, pitch_deck, financial_projection, market_study, other
- Statut: draft, final, archived
- Support tags et notes

---

## 🔒 Sécurité

**Row Level Security (RLS) activée sur les 2 tables:**
- ✅ Chaque utilisateur ne voit que ses propres données
- ✅ Impossible de modifier/supprimer les données des autres
- ✅ Politiques strictes sur CREATE, READ, UPDATE, DELETE

---

## 🚀 Routes API disponibles

Une fois les migrations effectuées:

### Projets
- `GET /api/projects?userId=xxx` → Liste des propositions
- `DELETE /api/projects/:id?userId=xxx` → Suppression

### Documents
- `GET /api/docs?userId=xxx` → Liste des documents
- `DELETE /api/docs/:id?userId=xxx` → Suppression

### Tests (déjà créés)
- `GET /api/skill-test/user/:userId` → Liste des tests
- `PUT /api/skill-test/:testId/complete` → Complétion du test
