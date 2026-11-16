# Frontline UX/UI — immersive design intelligence studio (formerly UI Compass)

A responsive UI/UX design recommendation workspace. Tell it what you want to build, compare **all three** original UI styles, record feedback and return later to continue your design decisions.

## What's in v0.4

- Three original design directions: **Minimal SaaS**, **Glass UI**, **Creative UI**.
- Multi-select feedback: choose any combination, including all three, before saving like/dislike/change signals.
- Interactive original composition preview adapts to the brief category and selected style(s), with desktop/mobile switches and a navigable overview/insights mockup.
- Unsaved feedback/chat drafts survive style switching and preview changes.
- Explainable prompt-based recommendation rankings using a curated reference index.
- 12 verified UI/UX leaderboard entries (August 2026 archive) plus three additional, explicitly unranked sites; credited outbound links and original illustrative thumbnails only.
- Studio assistant with a useful deterministic design guide; optional Gemini API (primary) and OpenRouter (secondary) integration.
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
GEMINI_API_KEY=your-private-google-ai-studio-key
GEMINI_MODEL=gemini-3.5-flash-lite
AI_PRIMARY_PROVIDER=gemini
OPENROUTER_API_KEY=your-optional-openrouter-key
OPENROUTER_MODEL=openrouter/free
AI_FALLBACK_ENABLED=false
```

`GET /api/health` provides a basic health report, and `GET /api/config` indicates whether database persistence and generative AI are currently enabled. No API key is necessary for the baseline recommendation engine.

### Test

```bash
NODE_ENV=test npm test
```

The automated suite checks three-style recommendations, feedback signal learning, exact seed ranking count, build-prompt fusion, project CRUD, user-isolation, messages and deletion.

## Deploy to Render

The app is hosted on a Render Node web service at https://ui-compass-studio.onrender.com, deployed directly from `main` in the Singapore region. The checked-in `render.yaml` also defines a reproducible web + PostgreSQL Blueprint for future infrastructure setup, but this Blueprint has **not** been applied. The live service currently uses the project's dedicated PostgreSQL schema on Supabase. Its /api/health reports `database: connected` when persistence is active. Verify backups and restore readiness before onboarding sensitive production clients.

For Gemini-powered chat, add `GEMINI_API_KEY` in your Render service's **Environment** settings. Keep `AI_PRIMARY_PROVIDER=gemini`; optionally add `OPENROUTER_API_KEY` to enable OpenRouter as an alternative. Setting `AI_FALLBACK_ENABLED=true` explicitly permits sharing the same user prompt with OpenRouter **only if Gemini fails**. Keep it `false` by default to avoid unexpected cross-provider data transfers. If neither provider works, the deterministic design guide remains available. Never put keys in GitHub, in a browser, or in the chat.

**AI data-use note:** Google Gemini API's free tier may use submitted content to improve Google's products; the paid tier has different terms. Free model availability, project rate limits and provider rules change. Use fictional design briefs for initial tests, obtain appropriate end-user consent before sending private client data, and select a suitable paid/data-protected tier before production deployment with confidential conversations.

Generate UI/UX now produces a **detailed copyable prompt comparing three original design directions** and a structured page/design-system brief. Design Fusion synthesizes 1–3 selected styles and the visitor's privately saved reference metadata into **one original copyable prompt**. Both call the AI provider when available and fall back to a useful offline prompt if needed. No executable UI code or live website clone is generated. The existing illustrative preview remains illustrative.

The first deliberate Generate/Fusion action per project/mode automatically strengthens the visitor's **private** style preferences once. Repeated use of the copy action does not inflate the score. Cross-user patterns remain opt-in and protected by the five-distinct-visitor threshold. Build/CI tests never invoke your real Gemini or OpenRouter key.

**Provider troubleshooting:** The chat bubble labels actual Gemini/OpenRouter answers by provider; a 'Guided recommendations · AI fallback' label means AI did not return an answer. Render logs show only sanitized provider HTTP status (e.g. 400/403/429/503) or timeout, not private prompts, keys or server error response bodies. Google now limits Gemini 2.5 availability for new projects; `gemini-3.5-flash-lite` is the recommended starting model for eligible new free-tier API projects. Confirm model availability and free limits in AI Studio.

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
## Chat-first React Bits redesign (v0.3)

- Original React Bits `TechText` and `StarBorder` components live under `src/components` and retain the upstream license in `REACT-BITS-LICENSE.md`.
- React 19 + Vite build to `dist/`. Render still runs `npm install --omit=dev` and `npm start`; Vite builds automatically through `postinstall`.
- Composer starts centered and docks at the bottom on focus or submission. Scrolling the landing triggers a bottom-to-center rise sequence. Messages float above the docked composer.
- All features are inside one menu; light/dark themes and reduced-motion support are included.
- All original backend API endpoints and project / learning logic are preserved. No persistent storage or AI model key is configured in the existing free Render deployment.


## Frontline UX/UI cinematic landing (2026-11-16)

- A custom original solar / architectural landing inspired by the motion language (not the assets, font, or code) of Casa di Solare.
- Five scroll chapters: Intro, Select UI/UX, Generate UI/UX, Design Fusion, and Personal Preferences.
- Scroll-animated luminous sphere, water reflection and ripples, pointer parallax, responsive decorative architecture, staged typography and in-scene actions.
- The centered chat composer remains available on the intro; it docks on feature chapters and rises on the final chapter. Interacting with it opens the existing chat workspace.
- Menu, projects, feedback API, guest privacy, optional OpenRouter and optional PostgreSQL backend are intentionally unchanged.
- Styles are hand-authored CSS with reduced-motion accessibility. The landing is an original Frontline design and is not represented as the Casa di Solare site's proprietary 3D assets or source implementation.

### Important limitations

Generate mode currently offers design guidance and original illustrative concepts, not exported running React apps. The saved preference system depends on persistent PostgreSQL; temporary in-memory Render storage is not durable. Implicit final-choice learning is planned, not yet implemented. Do not describe these as shipped features.
