-- Fix youtube_cache table to add UNIQUE constraint on video_id
-- This resolves the ON CONFLICT error in youtube-feed function

-- Add UNIQUE constraint to video_id column
ALTER TABLE youtube_cache 
ADD CONSTRAINT youtube_cache_video_id_unique UNIQUE (video_id);

-- Create index on video_id for better performance
CREATE INDEX IF NOT EXISTS idx_youtube_cache_video_id ON youtube_cache(video_id);
