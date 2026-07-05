-- Chantier C — Ateliers pratiques (livrable par module, corrigé par IA)
-- 1) Consigne d'atelier générée une fois puis mise en cache sur le cours
alter table formation_courses
  add column if not exists deliverable_brief text;

-- 2) Travaux rendus par les apprenants + feedback IA (grille notée)
create table if not exists formation_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  level int not null default 1,
  content text not null,
  score int,
  feedback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

create index if not exists idx_formation_deliverables_user on formation_deliverables (user_id);

-- Accès uniquement via le backend (service role) — pas de policies publiques
alter table formation_deliverables enable row level security;
