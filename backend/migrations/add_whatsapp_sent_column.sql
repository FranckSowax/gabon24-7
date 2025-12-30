-- Add whatsapp_sent column to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT FALSE;

-- Create index for faster querying of unsent articles
CREATE INDEX IF NOT EXISTS idx_articles_whatsapp_sent 
ON articles(whatsapp_sent) 
WHERE whatsapp_sent = FALSE;
