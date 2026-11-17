# Frontline UX/UI — immersive design intelligence studio (formerly UI Compass)

A responsive UI/UX design recommendation workspace. Tell it what you want to build, compare **all three** original UI styles, record feedback and return later to continue your design decisions.

## What's in v0.4

- Three original design directions: **Minimal SaaS**, **Glass UI**, **Creative UI**.
- Multi-select feedback: choose any combination, including all three, before saving like/dislike/change signals.
- Interactive original composition preview adapts to the brief category and selected style(s), with desktop/mobile switches and a navigable overview/insights mockup.
- Unsaved feedback/chat drafts survive style switching and preview changes.
- Explainable prompt-based recommendation rankings using a curated reference index.
- 12 verified UI/UX leaderboard entries (August 2026 archive) plus three additional, explicitly unranked sites; credited outbound links and original illustrative thumbnails only.
- Studio assistant with a useful deterministic design guide; OpenRouter AI (primary), GroqCloud (optional backup) and dormant optional Gemini integration.
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
OPENROUTER_API_KEY=your-private-openrouter-key
OPENROUTER_MODEL=openrouter/free
AI_PRIMARY_PROVIDER=openrouter
GROQ_API_KEY=your-private-groqcloud-key
GROQ_MODEL=openai/gpt-oss-20b
AI_FALLBACK_PROVIDER=groq
AI_FALLBACK_ENABLED=true
# Optional dormant Gemini credentials; unused by normal OpenRouter→Groq routing:
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

`GET /api/health` provides a basic health report, and `GET /api/config` indicates whether database persistence and generative AI are currently enabled. No API key is necessary for the baseline recommendation engine.

### Test

```bash
NODE_ENV=test npm test
```

The automated suite checks three-style recommendations, feedback signal learning, exact seed ranking count, build-prompt fusion, project CRUD, user-isolation, messages and deletion.

## Deploy to Render

The app is hosted on a Render Node web service at https://ui-compass-studio.onrender.com, deployed directly from `main` in the Singapore region. The checked-in `render.yaml` also defines a reproducible web + PostgreSQL Blueprint for future infrastructure setup, but this Blueprint has **not** been applied. The live service currently uses the project's dedicated PostgreSQL schema on Supabase. Its /api/health reports `database: connected` when persistence is active. Verify backups and restore readiness before onboarding sensitive production clients.

**Recommended AI routing:** OpenRouter is the first provider (`AI_PRIMARY_PROVIDER=openrouter`, `OPENROUTER_MODEL=openrouter/free`). GroqCloud is the explicit optional backup (`AI_FALLBACK_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b`). Create `GROQ_API_KEY` at https://console.groq.com/keys and add it **only** to your Render service's Environment panel. The Groq API endpoint is `https://api.groq.com/openai/v1/chat/completions`; no browser-side key and no new client library are required. With `AI_FALLBACK_ENABLED=true`, user prompts are shared with Groq **only if OpenRouter fails**. Disable it to disallow that second-provider transfer. Gemini is preserved but not called in this route, even if `GEMINI_API_KEY` remains set. Explicitly selecting `AI_PRIMARY_PROVIDER=gemini` can still activate it. If configured providers fail, the deterministic design guide remains available. Never commit or paste API keys. Provider availability and free-tier limits depend on account and model; Groq's published pay-as-you-go token pricing applies to usage beyond any included free-tier allowance.

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


## Milestone 06 — contextual design intelligence (November 2026)

This release builds on the existing OpenRouter-first, prompt-only studio. This product is not an automatic website-code generator.

- Brief understanding: evidence-linked user roles, requested modules, constraints, proposed sitemap and workflows, plus unanswered questions. Inferences are marked as proposals.
- Select UI/UX: recommendations and copyable prompts include brief-specific pages, goals, constraints and tradeoffs. Inspiration is ranked from curated metadata; no screenshot/site crawl is implied.
- Generate UI/UX: three original design directions, responsive components, acceptance checklist and requirements-preserving refinements.
- Design Fusion: an explainable structural anchor and supporting styles blended into one cohesive result.
- Review: prompt-only section coverage checks prevent short/incomplete model drafts from replacing the full structured specification. The UI identifies fallback.
- Studio: a Project Intelligence panel shows project facts, pages, clarification questions and style comparisons. Ratings are heuristic indicators, not calibrated statistics, accessibility audits or user-test outcomes.
- Persistence/privacy: no schema changes, no changes to guest ownership or cross-user learning. Older projects are enriched on read without rewriting stored history.
- Testing: unit/API regression plus Chromium/Firefox. The opt-in diagnostic release validates the exact Render deployed SHA, two real fictional OpenRouter chats, two fictional Generate/Fusion specifications, and deletion of the synthetic guest.

To keep OpenRouter as the only live provider: AI_PRIMARY_PROVIDER=openrouter, OPENROUTER_MODEL=openrouter/free, AI_FALLBACK_ENABLED=false. Never paste secrets into GitHub issues or logs.

### Limitations
Brief extraction is a rule-based baseline, not verified comprehension. Missing details must be confirmed. AI responses are nondeterministic and free-model availability can change. Prompt section checks are safeguards, not proof of correctness or a live-device usability/accessibility audit. Authentication, live website screenshot analysis and running-app generation remain out of scope.


### Milestone 06 reliability refinement

The complete Generate/Fusion specification is always assembled from explicit project requirements, user-visible design heuristics, page maps and acceptance criteria. OpenRouter is now asked for a **short original creative layer** rather than a multi-thousand-token specification. Only project-relevant, prompt-only insights that pass screening are appended as optional refinements. The UI labels this as a structured specification with AI enhancements; it does not imply that the model authored every section. If the free route times out, the full local specification remains available and honestly labeled. This keeps OpenRouter as the sole live provider, without additional keys or database migrations.

### OpenRouter free-router reliability and quota-aware behavior (Nov 17, 2026)

The site received OpenRouter HTTP 429 quota-limit and timeout responses while users tested the three modes. These are external availability constraints. The free-router usage limit is generally 20 requests/minute and 50 requests/day for unfunded accounts; failed attempts may count toward the daily limit. Higher allowances may require an eligible funded account, which is not necessary for the complete structured fallback.

To conserve a shared free key, Frontline defaults to ONE OpenRouter request per user action on openrouter/free or a :free model, compacts recent chat context, asks for concise answers, and never presents provider-marked incomplete text as a complete final design. OPENROUTER_MAX_ATTEMPTS=2 is opt-in for a more generous plan, not the default. A 429 causes a short process-local cooldown and clear user-facing guidance. Logs contain only safe provider/status metadata. The app does not send private prompts to another provider without explicit opt-in.

Generate/Fusion specifications remain available from the grounded structured design engine, even without an optional AI creative refinement. Quality checks remain active. These changes reduce unnecessary requests but cannot override external rate limits or guarantee 100% free-model uptime.


## Milestone 07 — personalized design learning + compact studio chat

Stage 07A–07C foundation. The existing profile/feedback tables and guest-scoped identity were retained. No schema migration and no additional provider required.

- **Private memory:** Explicit style feedback and once-per-project-mode finalization influence later Select, Generate, Fusion and inspiration rankings. Project requirements override private preferences.
- **Learning & Privacy controls:** View per-style likes/dislikes/improvements, correct style signals from -5 to +5, and set motion, content density, contrast priority and color atmosphere. Do not infer sensitive traits or mine raw private chat transcripts.
- **Pause and clear:** Pausing stops using and updating design memories and refuses new feedback. Clearing deletes only this visitor's feedback and resets preferences, but preserves saved projects, conversations and inspirations. Existing full workspace deletion remains distinct.
- **Persistence:** Preference metadata is stored inside the existing per-visitor frontline.uic_profiles.style_weights JSONB field under the reserved namespace _personalization. Older visitor profiles still load.
- **Collective consent:** Opt-in remains separate and off by default. Public patterns require five distinct current opted-in contributors per style. Opting out or pausing revokes earlier feedback eligibility, not only future contributions. Raw project messages are not part of shared learning.
- **AI:** Compact private preference hints are provided only while learning is enabled; explicit current brief constraints take precedence. OpenRouter-only routing and structured fallback remain unchanged.
- **Chat UI:** Docked composer is ~660px max width, starts as one line, grows on demand, and reserves conversation scrolling clearance. Original gold StarBorder/glow/canvas, light/dark appearance, buttons, landing spiral and cinematic entrance remain unchanged.

**Limitations:** Rule-based preference signals, not new trained model weights or validated matching scores. Guest identity is tied to the browser cookie; it does not authenticate users across devices. Collective model training and account-based memory migration remain out of scope.


## Milestone 07D — preference learning quality and privacy release gate (17 Nov 2026)

This release does not create a new AI model. Design learning is deterministic and explainable, uses the existing per-guest profile and feedback records, and always treats the current project brief as primary.

### Feedback quality and control

- One project + one design style = one current reaction. Identical Like/Dislike/Improve submissions do not earn extra style weight. Changing Like to Dislike reverses the previous +1 signal; changing to Improve produces a neutral signal. Old feedback records are retained as history. No user projects are rewritten.
- Private feedback evidence and public opt-in patterns use only the latest reaction per project/style, rather than counting historical Likes after a reversal. Prior duplicates may have inflated older stored weights: users can correct weights in Learning & Privacy or clear only preference memory without deleting projects.
- The feedback API returns saved (selected styles) and changed (recorded changes). The frontend explains repeated unchanged reactions instead of awarding imaginary points.
- Design comparisons show the *actual bounded heuristic point change* from private feedback, including saturation at the 48–96 score limits. Scores are not usability audits or empirical evidence.

### Shared-pattern privacy and limitations

- Aggregate results remain opt-in only, with at least five distinct currently opted-in GUEST VISITOR IDs. Raw chats, private feedback text and visitor identifiers are not returned.
- Public counts are coarse ranges: 5–9, 10–24, 25+. A revised or withdrawn Like no longer counts; revoking consent or pausing learning excludes prior feedback.
- Guest browser IDs are NOT verified people. Five-ID minimum is a basic disclosure gate, not proven k-anonymity, independent research, or a guarantee against multiple browser identities. Do not use these patterns to train a shared model before a separate privacy review.
- Cookie-authorized write routes reject cross-origin browser origins and require JSON request bodies. Existing SameSite and HttpOnly cookie protections remain unchanged.

### Reproducible validation

- npm run evaluate:learning runs nine synthetic product briefs and checks deterministic brief-first ranking, all-three-style coverage, bounded scoring and monotonic personal feedback effects; the command fails if a contract regresses.
- Node/API tests cover idempotent feedback, reversals, user isolation, consent revocation and cohort disclosure limits.
- Chromium/Firefox tests cover the actual UI. After an exact deployed SHA is verified, a disposable-guest smoke test checks real PostgreSQL feedback, revisions, pause/reset and cleanup without making any OpenRouter requests.
- Synthetic benchmark pass rates measure deterministic software contracts, NOT real-world UX quality, model precision, accessibility conformance or verified improvements for actual users.

Deferred: verified account identity, consent-based longitudinal evaluation, cross-device learning and rigorous formal privacy guarantees for aggregated community patterns. OpenRouter free-model quotas remain independent. The compact golden StarBorder composer, cinematic landing, three design modes and existing data remain intact.
