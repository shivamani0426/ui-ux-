# UI Compass — Design, with direction

A responsive UI/UX design recommendation workspace. Tell it what you want to build, compare **all three** original UI styles, record feedback and return later to continue your design decisions.

## What's in v0.2

- Three original design directions: **Minimal SaaS**, **Glass UI**, **Creative UI**.
- Multi-select feedback: choose any combination, including all three, before saving like/dislike/change signals.
- Interactive original composition preview adapts to the brief category and selected style(s), with desktop/mobile switches and a navigable overview/insights mockup.
- Unsaved feedback/chat drafts survive style switching and preview changes.
- Explainable prompt-based recommendation rankings using a curated reference index.
- 12 verified UI/UX leaderboard entries (August 2026 archive) plus three additional, explicitly unranked sites; credited outbound links and original illustrative thumbnails only.
- Studio assistant with a useful deterministic design guide; optional OpenRouter model integration.
- PostgreSQL-backed project history, conversation history, learned personal style preferences, and opt-in aggregate feedback.
- Privacy controls: isolated guest identities, deletion, collective learning off by default, no publishing raw conversations.
- Copyable implementation prompts that blend selected designs.
- Responsive overview, studio, inspiration gallery, projects and learning pages.

## Quick start

```bash
npm install
npm start
```
Open http://localhost:3000. Node.js 20 or later is required. Without `DATABASE_URL`, the app uses an **ephemeral development-only** memory store. With a PostgreSQL connection string, it stores projects/preferences/chats persistently and creates its own tables at startup.

Optional environment variables (never commit the actual secret):

```text
DATABASE_URL=postgresql://...
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

`GET /api/health` provides a basic health report, and `GET /api/config` indicates whether database persistence and generative AI are currently enabled. No API key is necessary for the baseline recommendation engine.

### Test

```bash
NODE_ENV=test npm test
```

The automated suite checks three-style recommendations, feedback signal learning, exact seed ranking count, build-prompt fusion, project CRUD, user-isolation, messages and deletion.

## Deploy to Render

The app is hosted on a **free Render Node web service** at https://ui-compass-studio.onrender.com, deployed directly from `main` in the Singapore region. The checked-in `render.yaml` also defines a reproducible web + PostgreSQL Blueprint for future infrastructure setup, but this Blueprint has **not** been applied. The Render workspace already has its maximum one active free PostgreSQL database, so UI Compass runs with temporary memory until its own database is available. Do not interpret the `database: demo-memory` health response as durable persistence. Render free PostgreSQL instances are temporary and expire unless upgraded, so use a maintained database and backups before storing important customer history.

Once the deployment becomes live, add `OPENROUTER_API_KEY` in the Render service's Environment panel if you want real model-generated chat responses. Without it, the guide still works but is **rule-based**, not a generative model.

**Current limitations:** no user accounts (anonymous browser-cookie identity only), no live crawling or screenshot analysis, and visual previews are original illustrative mockups rather than rendered generated application code. Do not describe these as implemented. These are future milestones.

## Privacy and attribution

- Individual guest chats and projects are scoped to an unguessable browser cookie.
- Cross-user metrics require opt-in and 5 distinct contributors before appearing.
- Data deletion removes this guest identity's project, chats, preference signals, and feedback.
- Reference links are public inspiration only; UI Compass does not ingest proprietary source files or distribute external website screenshots.
- The verified category ranking comes from https://www.webdesignawards.io/categories/ui-ux-design. Some previously reported ranks were stale; only 12 are listed in the checked archive.

## Architecture

- `server.mjs` — built-in Node HTTP server, REST endpoints, scoped guest identity, optional LLM.
- `design-engine.mjs` — deterministic recommendations, original style library, reference index and export.
- `public/` — fast zero-build browser interface and original CSS mockups.
- `tests/` — built-in `node:test` suite.
- `render.yaml` — web service and database infrastructure.

Designed to expand toward a richer AI Design Fusion experience, authenticated teams, visual website analysis, and AI-generated React code with sandboxed previews.