-- Fix for notes table missing columns
-- Run this in Supabase Dashboard > SQL Editor

-- Add starred column if not exists
ALTER TABLE notes ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;

-- Add word_count column if not exists
ALTER TABLE notes ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- Create index for starred notes
CREATE INDEX IF NOT EXISTS idx_notes_starred ON notes(starred) WHERE starred = TRUE;

SELECT 'Notes table fixed successfully' as status;
