-- Table pour gérer la queue des résumés IA
CREATE TABLE IF NOT EXISTS pending_ai_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 1, -- 1=high, 2=medium, 3=low
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(article_id)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_pending_ai_summaries_status_priority 
ON pending_ai_summaries(status, priority, created_at);

-- Table pour gérer les groupes de flux RSS
CREATE TABLE IF NOT EXISTS rss_feed_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
    group_name VARCHAR(10) NOT NULL CHECK (group_name IN ('A', 'B')),
    processing_order INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(feed_id)
);

-- Fonction pour assigner automatiquement les flux aux groupes
CREATE OR REPLACE FUNCTION assign_feeds_to_groups()
RETURNS void AS $$
DECLARE
    feed_record RECORD;
    group_letter VARCHAR(1);
    counter INTEGER := 0;
BEGIN
    -- Vider la table existante
    DELETE FROM rss_feed_groups;
    
    -- Assigner chaque flux actif à un groupe (alternance A/B)
    FOR feed_record IN 
        SELECT id FROM rss_feeds 
        WHERE status = 'active' 
        ORDER BY priority DESC, id ASC
    LOOP
        counter := counter + 1;
        group_letter := CASE WHEN counter % 2 = 1 THEN 'A' ELSE 'B' END;
        
        INSERT INTO rss_feed_groups (feed_id, group_name, processing_order)
        VALUES (feed_record.id, group_letter, counter);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Exécuter l'assignation
SELECT assign_feeds_to_groups();
