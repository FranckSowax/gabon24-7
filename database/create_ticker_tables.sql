-- Table des messages du bandeau
CREATE TABLE ticker_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contenu
    original_title text NOT NULL,
    reformulated_title text NOT NULL,
    message_type text CHECK (message_type IN ('auto', 'manual', 'urgent')) DEFAULT 'auto',
    
    -- Source
    article_id uuid REFERENCES feed_items(id),
    article_url text,
    source_name text,
    source_logo text,
    
    -- Configuration
    is_active boolean DEFAULT true,
    is_urgent boolean DEFAULT false,
    priority integer DEFAULT 0, -- Plus élevé = plus prioritaire
    
    -- Timing
    display_start timestamptz DEFAULT now(),
    display_end timestamptz DEFAULT (now() + interval '3 hours'),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Métadonnées
    click_count integer DEFAULT 0,
    last_displayed_at timestamptz,
    edited_by uuid REFERENCES auth.users(id),
    ai_tokens_used integer DEFAULT 0
);

-- Table de configuration du bandeau
CREATE TABLE ticker_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Paramètres d'affichage
    is_enabled boolean DEFAULT true,
    speed integer DEFAULT 50, -- pixels par seconde
    pause_on_hover boolean DEFAULT true,
    
    -- Paramètres de contenu
    max_messages integer DEFAULT 20,
    refresh_interval integer DEFAULT 300, -- secondes
    message_duration integer DEFAULT 10800, -- 3 heures en secondes
    
    -- Style
    background_color text DEFAULT '#1f2937',
    text_color text DEFAULT '#ffffff',
    urgent_color text DEFAULT '#ef4444',
    height integer DEFAULT 40, -- pixels
    font_size integer DEFAULT 14,
    
    -- Filtres
    excluded_sources text[] DEFAULT '{}',
    included_categories text[] DEFAULT '{}',
    min_article_age_minutes integer DEFAULT 0,
    max_article_age_minutes integer DEFAULT 180,
    
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- Table de logs pour tracking
CREATE TABLE ticker_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES ticker_messages(id),
    event_type text CHECK (event_type IN ('displayed', 'clicked', 'edited', 'created', 'deleted')),
    user_id uuid REFERENCES auth.users(id),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Indexes pour performance
CREATE INDEX idx_ticker_messages_active ON ticker_messages(is_active, display_start, display_end);
CREATE INDEX idx_ticker_messages_priority ON ticker_messages(priority DESC, created_at DESC);
CREATE INDEX idx_ticker_messages_urgent ON ticker_messages(is_urgent) WHERE is_urgent = true;
CREATE INDEX idx_ticker_logs_message ON ticker_logs(message_id, created_at DESC);

-- Fonction pour nettoyer les vieux messages
CREATE OR REPLACE FUNCTION cleanup_old_ticker_messages()
RETURNS void AS $$
BEGIN
    UPDATE ticker_messages 
    SET is_active = false 
    WHERE display_end < now() 
    AND message_type = 'auto';
    
    DELETE FROM ticker_messages 
    WHERE created_at < now() - interval '7 days' 
    AND message_type = 'auto';
END;
$$ LANGUAGE plpgsql;

-- Insérer une configuration par défaut
INSERT INTO ticker_config (
    is_enabled,
    speed,
    pause_on_hover,
    max_messages,
    refresh_interval,
    message_duration,
    background_color,
    text_color,
    urgent_color,
    height,
    font_size
) VALUES (
    true,
    50,
    true,
    20,
    300,
    10800,
    '#1f2937',
    '#ffffff',
    '#ef4444',
    48,
    14
) ON CONFLICT DO NOTHING;
