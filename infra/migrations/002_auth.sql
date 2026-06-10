-- ============================================================
--  Migration 002 — Auth tables + authenticated role
-- ============================================================

-- Role PostgREST switches to for authenticated requests
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;

-- ============================================================
--  AUTH USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  email         text NOT NULL,
  password_hash text NOT NULL,
  app_role      text NOT NULL DEFAULT 'sales',  -- admin / sales / viewer
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

-- ============================================================
--  REFRESH TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,   -- SHA-256 of the actual token
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ============================================================
--  Seed a default admin user
--  email: admin@navbharat.com  password: changeme123
--  (bcrypt cost 12 hash of "changeme123")
-- ============================================================

INSERT INTO auth_users (org_id, email, password_hash, app_role)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@navbharat.com',
  '$2a$12$RSd7w2nTfziXR1VOZk7xtediFLQ7yNKDLum1jfvZ1eS1tbCJBOeyG',
  'admin'
)
ON CONFLICT DO NOTHING;
