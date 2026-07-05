-- Chantier B — Révision espacée (Leitner) + streaks d'apprentissage

-- 1) Cartes de révision : une question de QCM ratée = une carte reprogrammée
--    J+1 → J+3 → J+7 → J+21 (boîtes de Leitner)
create table if not exists formation_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  question_index int not null,
  question jsonb not null, -- { question, options, correctIndex, explanation, level }
  box int not null default 1,
  due_at timestamptz not null default now() + interval '1 day',
  last_result boolean,
  reps int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module_id, question_index)
);

create index if not exists idx_formation_reviews_due on formation_reviews (user_id, due_at);
create index if not exists idx_formation_reviews_due_global on formation_reviews (due_at);

-- 2) Activité quotidienne (base du streak 🔥)
create table if not exists formation_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- Accès uniquement via le backend (service role)
alter table formation_reviews enable row level security;
alter table formation_activity enable row level security;
