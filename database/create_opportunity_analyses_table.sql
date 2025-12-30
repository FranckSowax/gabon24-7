-- Create opportunity_analyses table for Business Intelligence module
CREATE TABLE IF NOT EXISTS opportunity_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Article information
    article_title TEXT NOT NULL,
    article_summary TEXT,
    article_source TEXT,
    article_url TEXT,
    
    -- Opportunity analysis results
    opportunity_title TEXT NOT NULL,
    opportunity_description TEXT NOT NULL,
    category TEXT NOT NULL,
    potential_revenue TEXT,
    investment_required TEXT,
    timeline TEXT,
    market_size TEXT,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Full analysis data (JSON)
    analysis_data JSONB,
    
    -- User tracking
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Status and metadata
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'saved')),
    views_count INTEGER DEFAULT 0,
    is_premium BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_created_at ON opportunity_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_user_id ON opportunity_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_category ON opportunity_analyses(category);
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_confidence_score ON opportunity_analyses(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_analyses_status ON opportunity_analyses(status);

-- Enable Row Level Security (RLS)
ALTER TABLE opportunity_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own opportunity analyses" ON opportunity_analyses
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own opportunity analyses" ON opportunity_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own opportunity analyses" ON opportunity_analyses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own opportunity analyses" ON opportunity_analyses
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_opportunity_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_opportunity_analyses_updated_at
    BEFORE UPDATE ON opportunity_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_opportunity_analyses_updated_at();

-- Create saved_opportunities table for user bookmarks
CREATE TABLE IF NOT EXISTS saved_opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    opportunity_id UUID REFERENCES opportunity_analyses(id) ON DELETE CASCADE NOT NULL,
    notes TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    
    UNIQUE(user_id, opportunity_id)
);

-- Create indexes for saved_opportunities
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_user_id ON saved_opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_created_at ON saved_opportunities(created_at DESC);

-- Enable RLS for saved_opportunities
ALTER TABLE saved_opportunities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for saved_opportunities
CREATE POLICY "Users can manage their own saved opportunities" ON saved_opportunities
    FOR ALL USING (auth.uid() = user_id);

-- Create function to get user opportunity statistics
CREATE OR REPLACE FUNCTION get_user_opportunity_stats(user_uuid UUID)
RETURNS TABLE (
    total_analyses INTEGER,
    saved_count INTEGER,
    avg_confidence_score NUMERIC,
    top_category TEXT,
    recent_analyses_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_analyses,
        (SELECT COUNT(*)::INTEGER FROM saved_opportunities WHERE user_id = user_uuid) as saved_count,
        ROUND(AVG(oa.confidence_score), 2) as avg_confidence_score,
        (SELECT oa2.category 
         FROM opportunity_analyses oa2 
         WHERE oa2.user_id = user_uuid 
         GROUP BY oa2.category 
         ORDER BY COUNT(*) DESC 
         LIMIT 1) as top_category,
        (SELECT COUNT(*)::INTEGER 
         FROM opportunity_analyses oa3 
         WHERE oa3.user_id = user_uuid 
         AND oa3.created_at >= NOW() - INTERVAL '7 days') as recent_analyses_count
    FROM opportunity_analyses oa
    WHERE oa.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON opportunity_analyses TO authenticated;
GRANT ALL ON saved_opportunities TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_opportunity_stats(UUID) TO authenticated;
