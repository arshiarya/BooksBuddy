-- Migration 002: Add csrf_token to sessions table
-- For per-session server-validated CSRF protection

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS csrf_token VARCHAR(64);
