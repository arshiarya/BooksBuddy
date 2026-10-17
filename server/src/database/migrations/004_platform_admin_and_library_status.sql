-- BooksBuddy Platform Admin & Library Status Hardening
-- Migration: 004_platform_admin_and_library_status.sql

-- 1. Add role to users table (default: 'USER', with 'PLATFORM_ADMIN')
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(30) DEFAULT 'USER' NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role CHECK (role IN ('USER', 'PLATFORM_ADMIN'));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Add status to libraries table (default: 'ACTIVE', with 'SUSPENDED', 'DEACTIVATED')
ALTER TABLE libraries ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE libraries DROP CONSTRAINT IF EXISTS chk_libraries_status;
ALTER TABLE libraries ADD CONSTRAINT chk_libraries_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED'));
CREATE INDEX IF NOT EXISTS idx_libraries_status ON libraries(status);
