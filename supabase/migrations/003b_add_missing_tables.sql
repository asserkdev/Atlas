-- Fix for already-existing triggers
-- Just creates the missing tables if they don't exist

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own audit logs"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- ============================================
-- VERSION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS version_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    old_values JSONB NOT NULL,
    new_values JSONB NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_type, entity_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_version_history_entity ON version_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_version_history_changed_at ON version_history(changed_at DESC);

ALTER TABLE version_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own version history"
    ON version_history FOR SELECT
    USING (auth.uid() = changed_by);

CREATE POLICY IF NOT EXISTS "System can insert version history"
    ON version_history FOR INSERT
    WITH CHECK (true);

-- ============================================
-- Add soft delete columns to existing tables
-- ============================================
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add indexes if not exist
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notes_archived ON notes(archived);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at ON folders(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_info JSONB,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own sessions"
    ON user_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can manage their own sessions"
    ON user_sessions FOR ALL
    USING (auth.uid() = user_id);

-- ============================================
-- USER PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    keyboard_shortcuts_enabled BOOLEAN DEFAULT true,
    autosave_delay INTEGER DEFAULT 1000,
    default_note_sort TEXT DEFAULT 'updated_at',
    sidebar_collapsed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage their own preferences"
    ON user_preferences FOR ALL
    USING (auth.uid() = user_id);

-- Insert default preferences for existing users
INSERT INTO user_preferences (user_id)
SELECT id FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences WHERE user_preferences.user_id = auth.users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    device_info JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can manage their own tokens"
    ON refresh_tokens FOR ALL
    USING (auth.uid() = user_id);

-- ============================================
-- Auto-update timestamps function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- Comment on tables
-- ============================================
COMMENT ON TABLE audit_logs IS 'Audit trail for all data changes';
COMMENT ON TABLE version_history IS 'Historical versions of entities for undo/restore';
COMMENT ON TABLE user_sessions IS 'User session tracking for security';
COMMENT ON TABLE user_preferences IS 'User-specific preferences and settings';
COMMENT ON TABLE refresh_tokens IS 'Secure refresh tokens for session management';
