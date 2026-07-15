-- Script to create missing tables in Supabase
-- Run this in Supabase Dashboard > SQL Editor

-- ============================================
-- TAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#67e8f9',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- RLS for tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own tags" ON tags
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own tags" ON tags
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own tags" ON tags
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own tags" ON tags
    FOR DELETE USING (auth.uid() = user_id);

-- Index for tags
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- ============================================
-- NOTE_TAGS JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS note_tags (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);

-- RLS for note_tags
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own note_tags" ON note_tags
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM notes WHERE id = note_id
    ));

CREATE POLICY IF NOT EXISTS "Users can insert their own note_tags" ON note_tags
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM notes WHERE id = note_id
    ));

CREATE POLICY IF NOT EXISTS "Users can delete their own note_tags" ON note_tags
    FOR DELETE USING (auth.uid() IN (
        SELECT user_id FROM notes WHERE id = note_id
    ));

-- Index for note_tags
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);

-- ============================================
-- Add starred column to notes if missing
-- ============================================
ALTER TABLE notes ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- Index for starred notes
CREATE INDEX IF NOT EXISTS idx_notes_starred ON notes(starred) WHERE starred = TRUE;

-- ============================================
-- Verify tables exist
-- ============================================
SELECT 'Tags table created/verified' as status;
