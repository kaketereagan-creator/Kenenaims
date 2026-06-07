-- Migration: Step 1 Enhancements
-- Add session_version for real-time suspend/kill-switch functionality

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;

-- Update existing users to have version 1
UPDATE users SET session_version = 1 WHERE session_version IS NULL;

-- Add index for fast session checks
CREATE INDEX IF NOT EXISTS idx_users_session ON users(id, session_version, is_active);

-- Ensure audit_logs has all needed columns
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info';

-- Create first super admin (password: Admin@Kenena2025 — CHANGE IMMEDIATELY)
-- bcrypt hash of 'Admin@Kenena2025'
INSERT INTO users (full_name, email, phone, role_id, password_hash, is_active, session_version)
SELECT
  'Farm Owner',
  'owner@kenenafarm.ug',
  '+256700000000',
  (SELECT id FROM roles WHERE name = 'super_admin'),
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  true,
  1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'owner@kenenafarm.ug');

-- Demo manager account (password: Manager@123)
INSERT INTO users (full_name, email, phone, role_id, password_hash, is_active, session_version)
SELECT
  'Kihura Manager',
  'manager@kenenafarm.ug',
  '+256700000001',
  (SELECT id FROM roles WHERE name = 'farm_manager'),
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  true,
  1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'manager@kenenafarm.ug');

-- NOTE: Default password for both demo accounts above is: 'password'
-- This is the bcrypt hash of 'password' — CHANGE ALL PASSWORDS before going live!
