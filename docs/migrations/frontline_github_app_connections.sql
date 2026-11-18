-- Frontline M14D: encrypted, per-account GitHub App authorization.
-- Private schema is not exposed through Supabase's Data API.
CREATE TABLE IF NOT EXISTS frontline.github_app_connections (
  account_owner text PRIMARY KEY CHECK (account_owner ~* '^acct:[a-f0-9-]{36}$'),
  github_user_id bigint NOT NULL CHECK (github_user_id > 0),
  github_login varchar(39) NOT NULL,
  encrypted_credentials text NOT NULL CHECK (length(encrypted_credentials) BETWEEN 40 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE frontline.github_app_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE frontline.github_app_connections FROM PUBLIC, anon, authenticated;
