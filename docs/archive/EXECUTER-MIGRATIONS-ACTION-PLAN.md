# 🚀 Exécuter les Migrations Plan d'Action

## ❌ Erreur Actuelle
```
Could not find the table 'public.action_plan_checklists' in the schema cache
```

## ✅ Solution : Exécuter les Migrations SQL

### Étape 1 : Aller sur Supabase SQL Editor

1. Ouvrir : https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/sql/new
2. Cliquer sur **"SQL Editor"** dans la sidebar
3. Cliquer sur **"New query"**

---

### Étape 2 : Exécuter Migration 1 - Tables Checklist

**Copier-coller ce SQL dans l'éditeur :**

```sql
-- Migration: Système de checklist pour le Plan d'Action avec upload documents

-- Table pour stocker les checklists de plan d'action
CREATE TABLE IF NOT EXISTS action_plan_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_title TEXT NOT NULL,
  step_objective TEXT,
  step_duration TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, step_number)
);

-- Table pour stocker les items de checklist individuels
CREATE TABLE IF NOT EXISTS action_plan_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES action_plan_checklists(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  task TEXT NOT NULL,
  description TEXT,
  ai_prompt TEXT,
  requires_document BOOLEAN DEFAULT FALSE,
  document_type TEXT,
  placeholder TEXT,
  estimated_time TEXT,
  priority TEXT CHECK (priority IN ('haute', 'moyenne', 'basse')),
  answer TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  document_urls TEXT[],
  document_names TEXT[],
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(checklist_id, item_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_action_plan_checklists_project ON action_plan_checklists(project_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklists_user ON action_plan_checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklists_status ON action_plan_checklists(status);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklist_items_checklist ON action_plan_checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_checklist_items_completed ON action_plan_checklist_items(is_completed);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_action_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_action_plan_checklists_updated_at
  BEFORE UPDATE ON action_plan_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_action_plan_updated_at();

CREATE TRIGGER trigger_action_plan_checklist_items_updated_at
  BEFORE UPDATE ON action_plan_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_action_plan_updated_at();

-- Fonction pour calculer automatiquement le pourcentage de progression
CREATE OR REPLACE FUNCTION update_checklist_progress()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  completed_items INTEGER;
  new_progress INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_completed = TRUE)
  INTO total_items, completed_items
  FROM action_plan_checklist_items
  WHERE checklist_id = NEW.checklist_id;
  
  IF total_items > 0 THEN
    new_progress := ROUND((completed_items::DECIMAL / total_items) * 100);
  ELSE
    new_progress := 0;
  END IF;
  
  UPDATE action_plan_checklists
  SET 
    progress_percentage = new_progress,
    status = CASE
      WHEN new_progress = 0 THEN 'not_started'
      WHEN new_progress = 100 THEN 'completed'
      ELSE 'in_progress'
    END,
    completed_at = CASE
      WHEN new_progress = 100 THEN NOW()
      ELSE NULL
    END
  WHERE id = NEW.checklist_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_checklist_progress
  AFTER INSERT OR UPDATE OF is_completed ON action_plan_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_checklist_progress();

-- Politiques RLS
ALTER TABLE action_plan_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plan_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklists"
  ON action_plan_checklists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own checklists"
  ON action_plan_checklists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklists"
  ON action_plan_checklists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own checklists"
  ON action_plan_checklists FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own checklist items"
  ON action_plan_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own checklist items"
  ON action_plan_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own checklist items"
  ON action_plan_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own checklist items"
  ON action_plan_checklist_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM action_plan_checklists
      WHERE id = checklist_id AND user_id = auth.uid()
    )
  );

-- Vue pour faciliter les requêtes
CREATE OR REPLACE VIEW action_plan_checklist_summary AS
SELECT 
  c.id,
  c.project_id,
  c.user_id,
  c.step_number,
  c.step_title,
  c.status,
  c.progress_percentage,
  COUNT(i.id) as total_items,
  COUNT(i.id) FILTER (WHERE i.is_completed = TRUE) as completed_items,
  COUNT(i.id) FILTER (WHERE i.requires_document = TRUE) as items_requiring_docs,
  COUNT(i.id) FILTER (WHERE i.requires_document = TRUE AND array_length(i.document_urls, 1) > 0) as items_with_docs,
  c.started_at,
  c.completed_at,
  c.created_at,
  c.updated_at
FROM action_plan_checklists c
LEFT JOIN action_plan_checklist_items i ON c.id = i.checklist_id
GROUP BY c.id;
```

**Cliquer sur "Run" (ou Ctrl+Enter)**

✅ Vous devriez voir : **"Success. No rows returned"**

---

### Étape 3 : Exécuter Migration 2 - Bucket Storage

**Copier-coller ce SQL dans l'éditeur :**

```sql
-- Migration: Bucket Supabase Storage pour documents du Plan d'Action

-- Créer le bucket pour les documents du plan d'action
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'action-plan-documents',
  'action-plan-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour le bucket
CREATE POLICY "Users can upload own action plan documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'action-plan-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view own action plan documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'action-plan-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own action plan documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'action-plan-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own action plan documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'action-plan-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Cliquer sur "Run"**

✅ Vous devriez voir : **"Success. 1 row(s) returned"** (ou "No rows" si déjà existant)

---

### Étape 4 : Vérifier les Tables

**Exécuter cette requête pour vérifier :**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'action_plan%';
```

✅ Vous devriez voir :
- `action_plan_checklists`
- `action_plan_checklist_items`
- `action_plan_checklist_summary` (vue)

---

### Étape 5 : Vérifier le Bucket

**Aller sur Storage dans Supabase :**

https://supabase.com/dashboard/project/ykytsadwfqoyusleoflf/storage/buckets

✅ Vous devriez voir le bucket **`action-plan-documents`**

---

## 🎉 C'est Terminé !

Maintenant, rafraîchissez votre application et le bouton **"Générer le Plan d'Action"** devrait fonctionner !

### Test :
1. Aller dans **Mes Projets**
2. Cliquer sur **Plan d'Action** (sidebar)
3. Cliquer sur **"Générer le Plan d'Action"**
4. Le modal devrait s'ouvrir sans erreur 404 ! ✅

---

## 📝 Notes

- **Tables créées** : 2 tables + 1 vue
- **Bucket créé** : 1 bucket privé (10MB max par fichier)
- **RLS activé** : Sécurité par utilisateur
- **Triggers** : Calcul automatique progression
- **Types fichiers** : PDF, Word, Excel, Images, CSV

## 🆘 En Cas de Problème

Si erreur "permission denied" :
1. Vérifier que vous êtes connecté à Supabase
2. Vérifier que vous utilisez le bon projet (ykytsadwfqoyusleoflf)
3. Réessayer avec le service role key si nécessaire
