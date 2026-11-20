-- QA ONLY. Derived from the actual Frontline Supabase migration history.
-- Isolated GitHub Actions Postgres only; never apply to production.
-- NOLOGIN roles stand in for Supabase roles referenced by original REVOKE statements.
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END$$;

-- Original Supabase migration: frontline_private_foundation

-- Frontline UX/UI: private backend-only storage.
-- Tables are intentionally not exposed through Supabase public Data API.
create schema if not exists frontline;
revoke all on schema frontline from public, anon, authenticated;

create table if not exists frontline.uic_projects (
  id uuid primary key,
  visitor_id text not null check (char_length(visitor_id) between 32 and 64),
  title text not null,
  brief text not null,
  recommendation jsonb not null default '{}'::jsonb,
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists uic_projects_visitor_recent on frontline.uic_projects(visitor_id,updated_at desc);
create table if not exists frontline.uic_profiles (
  visitor_id text primary key,
  style_weights jsonb not null default '{}'::jsonb check (jsonb_typeof(style_weights)='object'),
  global_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists frontline.uic_feedback (
  id uuid primary key,
  visitor_id text not null,
  project_id uuid not null references frontline.uic_projects(id) on delete cascade,
  style_id text not null,
  reaction text not null check (reaction in ('like','dislike','edit')),
  detail text not null default '',
  eligible_global boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists uic_feedback_owner on frontline.uic_feedback(visitor_id,created_at desc);
create index if not exists uic_feedback_global on frontline.uic_feedback(style_id,visitor_id)
  where eligible_global=true and reaction='like';
create table if not exists frontline.design_sources (
  id text primary key,
  name text not null,
  site text not null unique,
  award text,
  category text not null,
  styles text[] not null default '{}',
  tags text[] not null default '{}',
  rank integer check (rank is null or rank > 0),
  score numeric(4,2) check(score is null or score between 0 and 10),
  summary text not null default '',
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists design_sources_styles on frontline.design_sources using gin(styles);
create index if not exists design_sources_tags on frontline.design_sources using gin(tags);
create table if not exists frontline.reference_selections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references frontline.uic_projects(id) on delete cascade,
  visitor_id text not null,
  source_id text not null references frontline.design_sources(id),
  selected boolean not null default true,
  final_choice boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id,source_id)
);
create index if not exists reference_selections_owner on frontline.reference_selections(visitor_id,project_id);
create table if not exists frontline.generated_prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references frontline.uic_projects(id) on delete cascade,
  visitor_id text not null,
  prompt_type text not null check(prompt_type in ('generate','fusion','select')),
  prompt_text text not null,
  styles text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists generated_prompts_owner on frontline.generated_prompts(visitor_id,project_id,created_at desc);
create table if not exists frontline.interaction_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  project_id uuid references frontline.uic_projects(id) on delete set null,
  source_id text references frontline.design_sources(id) on delete set null,
  event_type text not null check(event_type in ('select_source','deselect_source','final_choice','copy_prompt')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists interaction_events_owner on frontline.interaction_events(visitor_id,created_at desc);

-- RLS is defense in depth even though the schema isn't API exposed.
alter table frontline.uic_projects enable row level security;
alter table frontline.uic_profiles enable row level security;
alter table frontline.uic_feedback enable row level security;
alter table frontline.design_sources enable row level security;
alter table frontline.reference_selections enable row level security;
alter table frontline.generated_prompts enable row level security;
alter table frontline.interaction_events enable row level security;
-- No public/anon/authenticated policies. Only the trusted Node backend's DB connection uses this schema.
revoke all on all tables in schema frontline from anon, authenticated;
revoke all on all sequences in schema frontline from anon, authenticated;


-- Original Supabase migration: frontline_github_app_connections
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

-- Original Supabase migration: frontline_live_source_foundation_additive
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS is_live_discovered boolean NOT NULL DEFAULT false;
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT '';
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT '';
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS source_indexed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_frontline_source_indexed
  ON frontline.design_sources(source_indexed_at DESC)
  WHERE active=true AND is_live_discovered=true;
