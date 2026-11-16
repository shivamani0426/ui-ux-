# Frontline UX/UI — Supabase foundation

Production project: **frontline-ux**, Supabase project ref `jzlgdxkefabahwecejov`, Mumbai (ap-south-1).
GitHub repository: `shivamani0426/ui-ux-`, account `1nc24cs197@ncetmail.com`.
Do **not** connect this application to the unrelated JobPulse project.

## Applied remote migration

Migration `frontline_private_foundation` has been applied to the Frontline Supabase project.
The authoritative DDL is retained in Supabase's migration history.

Private schema: `frontline` (NOT included in the Supabase Data API exposed schemas).

- `uic_projects` — existing React/Node API project contract, includes JSONB messages and recommendations.
- `uic_profiles` — personal style weights and explicit aggregate opt-in.
- `uic_feedback` — user-owned feedback with opt-in snapshot and minimum-cohort aggregate.
- `design_sources` — searchable inspiration library, seeded with 15 existing repository references.
- `reference_selections` — storage reserved for future explicit source selection.
- `generated_prompts` — copied build prompts saved per visitor/project.
- `interaction_events` — schema prepared for future controlled learning events.

All seven tables have RLS enabled, and **no** policies/grants allow direct `anon` or `authenticated` access.
The Supabase linter may report informational `rls_enabled_no_policy` notices — intentional for backend-only tables in a non-exposed schema.
The Node server protects each private project lookup/update with its HttpOnly guest cookie and owner-scoped SQL.

## Connect Render to Supabase securely (one-time operator action)

1. In the **frontline-ux** Supabase dashboard, use **Connect** → **Session pooler** (IPv4), not the IPv6-only direct URL. Copy the exact PostgreSQL URI supplied by Supabase.
2. In the **ui-compass-studio** Render service, open **Environment** and create/update the secret `DATABASE_URL` with the exact URI; keep the password in Render secrets. Add `DB_SSL=require` only if needed by the selected Supabase endpoint and certificate configuration.
3. Save and deploy from the `main` branch. The server now validates the private tables at startup instead of creating public tables.
4. Check `GET /api/health` -> `database: "connected"` and `GET /api/config` -> `persistent: true`. Create a test project and reload to check its history; then redeploy once and check again.

Never put database passwords, JWT signing secrets or service-role keys in source control, frontend `VITE_*` variables, GitHub issues or chats.
A successful Supabase migration alone does NOT imply Render is already connected; its secret must be set.

## Safety and feature scope

This is a database foundation and integration change, **not** production account authentication.
Anonymous sessions still use HttpOnly UUID cookies (browser-dependent identity), not cross-device user accounts.
All personal data stays private; cross-user aggregated feedback requires opt-in and at least five distinct contributors.
Current Select mode uses the curated library in `frontline.design_sources`; it is not a live crawler or design screenshot search engine yet.
Our Generate/Fusion modes export detailed UI/UX prompts, not executable websites.
