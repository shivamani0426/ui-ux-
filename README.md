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


## Cinematic landing quality: guided autoplay and smooth rendering

The original all-black sculpted F portal is click-only. Its approximately 2.7-second white-light charge and three-second inside-out reveal are unchanged. The site now begins a **41.5-second five-chapter scroll journey automatically after the portal fully opens**; it uses quintic-eased motion and separate 2.2–3.2-second chapter reading holds rather than rushing or skipping over typography. The final chapter matures the original golden typographic spiral and reveals the existing star-border chat composer.

**Visitor control:** Pause, Replay and Skip are visible in a quiet accessible overlay. Wheel, touch, click/drag, keyboard scroll keys and tab hiding immediately pause autoplay; ordinary manual scrolling stays available. Reduced-motion preferences disable autoplay entirely. A visitor can stop and explore at any point, and the studio is not auto-entered.

**Performance without shrinking the visual design:** WebGL solar shaders are delayed until after the black portal is fully revealed, then staged. CSS sun and water are still complete fallbacks. Hidden canvases and background tabs no longer schedule perpetual WebGL RAF draws, and canvas dimensions/scroll range are cached until resize. Entrance glows retain full white luminous end frames but use composited static shadow layers whose opacity/scale changes instead of repainting large soft shadows at every frame. Only the current and neighboring text scenes are marked as priority compositor layers. Gold/cream color, architecture, editorial headings, star-border, scrolling spiral, all three tools, privacy memory, API and data are preserved.

**Validation:** node tests for all five chapter holds and continuous monotonic easing, original portal phases, visibility-based GPU pausing, and real Chromium/Firefox desktop + mobile autoplay, pause, replay, user interruption and reduced-motion navigation. This is software behavior validation: do not claim a particular FPS on untested hardware. For a real-device review, use browser performance profiling to inspect long tasks and dropped frames on the user's GPU and mobile browser.


## Milestone 09 — traceable design intelligence and prompt quality

Frontline remains a PROMPT-ONLY UI/UX recommendation and design-specification application, not a website/code generator. The cinematic F landing, guided auto-scroll, dark/light modes, compact golden StarBorder chat, PostgreSQL projects and private learning are unchanged.

### Specification contracts
- Generate still compares Minimal SaaS, Glass UI and Creative UI. Fusion still produces one coherent original direction from selected styles and does not clone real reference sites.
- A deterministic REQUIREMENT TRACEABILITY MATRIX maps every recognized explicit module, mentioned role, preserved constraint and decision to a proposed page and testable criterion; requested facts and proposed page permissions are clearly distinguished.
- ROLE-SPECIFIC NAVIGATION & PERMISSION STATES distinguishes student, teacher, admin, patient, customer and other named users. This is guidance only, not proof that authorization already exists in the customer's app.
- PER-PAGE INTERACTION CONTRACTS cover entry and return routes, actions, desktop/tablet/mobile adaptation, loading/empty/success/error/permission states and keyboard focus.
- Style directions include meaningful tokens, interaction, motion and accessibility VERIFICATION instructions, not claims of completed WCAG certification or backend integration.
- Extended brief recognition: attendance, exams and assessments, admissions, approvals, file submissions. Multi-role briefs ask about authorization, and AI tutors ask about reliable sources and error escalation.
- The existing prompt panel adds an expandable requirement-coverage summary with counts of features, roles, constraints, preserved decisions and any missing mappings.

### Quality gates
- A separate structured coverage reviewer checks the ACTUAL exported prompt instead of assuming the original brief's keywords prove that every requirement survived.
- The structured fallback and optional OpenRouter refinements maintain identical coverage. No extra OpenRouter requests, new AI provider, schema migration, new access permissions or sharing of private conversations.
- Cross-domain tests cover Generate and Fusion, missing-feature/role rejection, unknown audiences, complex education administration, AI fallback parity, preserved backend instructions and original prompt-only output.
- The checks are engineering contract tests, not empirical recommendation accuracy or a verified usability/accessibility audit. Customers must still confirm their roles, permissions and final visual design.


## Milestone 10A — cinematic login gateway (design / navigation)

The existing F-dome and full five-chapter golden scroll journey are preserved. The final
typographic spiral now reveals **Enter Studio** and **Login** inside an original
StarBorder-styled invitation, not a chat composer. Reveal timing is still tied to
spiral scroll progress; the studio composer continues to appear only after entry.

- **Enter Studio** expands a tiny black circle from the bottom-centre of the window
  into a full-screen portal, then reveals the existing studio with a soft rise.
- **Login** uses that same visual portal into the dedicated responsive `/login`
  page. The page inherits Frontline's copper, black, cream, gold and editorial type.
- **Enter Studio as Guest** from the login page uses the identical return gateway.
  Existing guest cookie isolation, project memory, AI requests and privacy remain
  unchanged. Direct `/login` and `/studio` URLs work on reload.
- Keyboard controls, browser history, user-scrolling takeover and reduced-motion
  preferences remain supported. The transition animates opacity/scale rather than
  repeatedly repainting shader effects.

**Authentication status:** this milestone delivers the login **screen and visual entry
flow**, not authenticated accounts. The Google button is deliberately disabled until
Supabase Auth's Google provider, OAuth redirect allowlist, verified sessions and secure
guest-to-account data migration are integrated and tested. No password is collected,
no user is falsely marked signed-in, and the guest workspace remains available.
Do not claim cross-device account sync has shipped.



## Milestone 10B — real Supabase Auth / Google sign-in

The Frontline server owns the OAuth PKCE code verifier and validated account
session; no browser JavaScript receives the Supabase access or refresh token.
On successful Google callback the server verifies the identity using
`/auth/v1/user`, transactionally migrates the guest browser's saved projects,
selections, prompts, feedback and learning profile to a stable account owner,
then opens `/studio`. Existing account projects are retained. Opt-in to
aggregated feedback is never transferred silently. Login is optional: guest
entry, studio design workflows and cinematic effects remain available.

### Required provider setup (cannot be simulated in application code)

1. In [Google Auth Platform](https://console.cloud.google.com/auth/clients),
   choose the correct Google Cloud project, configure the OAuth consent screen
   and create **Web application** OAuth credentials. Set Authorized JavaScript
   origin to `https://ui-compass-studio.onrender.com` and Authorized redirect
   URI to **exactly**:
   `https://jzlgdxkefabahwecejov.supabase.co/auth/v1/callback`.
   The Google Cloud client secret is PRIVATE; never paste it into an issue,
   repo, chat, frontend code or a Render public environment variable.
2. In [Supabase Google provider](https://supabase.com/dashboard/project/jzlgdxkefabahwecejov/auth/providers?provider=Google),
   enable Google and enter the client ID and secret there. In Supabase
   Authentication → URL Configuration, set Site URL to
   `https://ui-compass-studio.onrender.com` and allow the exact app redirect
   URL `https://ui-compass-studio.onrender.com/auth/callback`.
3. In **Render service environment** configure:
   - `FRONTLINE_SUPABASE_URL=https://jzlgdxkefabahwecejov.supabase.co`
   - `FRONTLINE_SUPABASE_PUBLISHABLE_KEY` (only the publishable project key)
   - `FRONTLINE_SITE_URL=https://ui-compass-studio.onrender.com`
   - `FRONTLINE_GOOGLE_LOGIN_ENABLED=true` **only after** Google OAuth
     credentials and both redirect allowlists are working.
   These values are read server-side. Do not use a service-role key.
4. Test with a Google account explicitly allowed by the Google consent screen.
   If the OAuth app is in Testing mode, add the account as a test user.
   Verify sign-in, back/forward navigation, account project history in
   another browser, guest→account migration, logout, and inability to read
   another visitor's project ID.

The provider feature flag defaults OFF until external credentials are ready.
`GET /api/auth/status` reports readiness without revealing API keys.
`GET /api/auth/me` returns only verified account display details.
`POST /api/auth/claim` can safely retry a failed guest transfer.
`POST /api/auth/logout` signs out and clears HttpOnly session cookies.

Security: short-lived access and rotating refresh cookies use `HttpOnly`,
`SameSite=Lax`, `Secure` plus the `__Host-` cookie prefix in production;
CSRF protection on state-changing APIs, PKCE S256, verified account identity,
private owner-scoped queries, and atomic guest migration. Keep this feature
unexposed until live real-account testing completes.



## Milestone 10D — Account security, session scopes and recovery

This release does not modify the cinematic landing, Google/login visuals, any
AI design mode, private project history, or saved design memory.

### Session management
- **Sign out of this device** calls Supabase Auth logout with
  `?scope=local`. It preserves sessions on other phones/laptops.
- **Sign out other devices** uses `?scope=others`, preserving this session.
- **Sign out everywhere** requires a separate confirmation and uses
  `?scope=global`. If the provider fails, the app reports an error rather
  than claiming it revoked all sessions.
- Supabase warns that already-issued JWT access tokens remain valid until
  expiry, even after refresh-session revocation. Set
  `FRONTLINE_STRICT_SESSION_CHECK=true` **only after verifying** that the
  runtime PostgreSQL connection can select `auth.sessions`, and verify the
  OAuth JWT includes `session_id`. When enabled, the backend checks that
  the live Supabase `auth.sessions` row is present on every request. It
  fails closed for missing/invalid sessions. Default is disabled until this
  production account-flow acceptance test is completed.
- Every authenticated request is rate-limited by the verified **Google
  account identity**, not a guest cookie that could be changed to evade
  request limits.

### Protected permanent account deletion

Deleting a workspace and permanently deleting an **Auth identity** are
different actions. The existing **Learning & privacy → Delete workspace**
deletes Frontline projects/feedback/preferences but retains Google sign-in.

Permanent account deletion is guarded by a separate **Account security**
panel and an API endpoint `DELETE /api/auth/account`. It requires:
1. Supabase Auth verifying the logged-in user on the server for the request;
2. a successful Google OAuth verification in the past **10 minutes**;
3. a correctly HMAC-signed HttpOnly SameSite=Strict recent-verification
   cookie containing the **same account ID**;
4. the exact signed-in email address and phrase
   `DELETE FRONTLINE ACCOUNT` typed into the confirmation form;
5. a successful read-only server-side Supabase Admin API preflight proving
   that the administrator can access the **same verified user ID**;
6. private workspace deletion in one PostgreSQL transaction, followed by
   Supabase Auth user deletion using the **server-only** administrator
   credential. After success, all local Auth cookies are cleared.

Deletion is intentionally **unavailable** until secure administrator setup.
No destructive action occurs if that credential is missing or invalid. A
partial failure after workspace deletion returns a clear warning and permits
safe retry of Auth deletion after re-verification. This is a two-service
operation; PostgreSQL deletion and an external Supabase Auth API call
cannot be made fully atomic. Never promise irreversible cleanup of global
backups beyond provider retention policies.

**Required Render environment secrets:**
- `FRONTLINE_ACTION_SIGNING_SECRET`: a cryptographically random secret,
  at least 48 characters, stable across server restarts; required for
  recently verified Google account markers.
- `FRONTLINE_SUPABASE_ADMIN_KEY`: a Supabase Auth administrator-capable
  secret/service-role credential, **server only**. Never put this in GitHub,
  frontend JavaScript, a public env variable, or a user-facing support
  message. Only configure this after verifying its exact intended scope
  and rotation policy.
- `FRONTLINE_STRICT_SESSION_CHECK`: optional, defaults to `false`.

Never run actual account deletion automatically in tests, or with any real
user's account without that user's deliberate confirmation in the app.
Account access/recovery is through the same Google account. Frontline never
stores or resets Google passwords.

### Verification
`npm test` now tests session scoping, invalid or revoked sessions,
HMAC-bound fresh verification, admin fail-closed behavior, guest/CSRF
denial, and existing user/guest isolation. Browser tests exercise the
guest security panel alongside the complete cinematic UI and design modes.


## Milestone 11 — AI Design Intelligence 2.0

The original Frontline landing, Google login and Select / Generate / Fusion modes
remain unchanged. Intelligence 2.0 improves project-specific decisions, not
claims of real-world UX testing or live reference-site scanning.

**Project understanding and exclusions.** The rules now distinguish an
explicitly requested module from a forbidden module (e.g. *build a product
catalog but no checkout or messaging*), preserve more recent brief refinements,
avoid interpreting generic "dashboard" as proof of a SaaS product, and label
low-evidence assumptions as provisional. Browsing a product catalog is not
the same requirement as completing checkout.

**Transparent rankings.** Every design direction retains its bounded
heuristic fit indicator, plus an itemized set of point factors, explicit
requirements, tradeoffs and mitigation suggestions. The ledger adds up to the
displayed number after clipping. These are judgment rules, **not** measured
accessibility scores, tested conversions or a private model's reasoning.

**Saved project refinement.** In an existing design conversation, expand
**Project Intelligence → Make recommendations more accurate**, enter up to 450
characters, and select **Update recommendations**. The account-scoped
`POST /api/projects/:id/intelligence` stores the new recommendation snapshot
without overwriting the original brief, chat, references or feedback.
You can reset the saved refinement and restore the original scope.
User ownership is checked before reading/writing every project; unrelated
visitors receive 404. Old projects are reanalyzed read-only when opened.

**Output fidelity.** Select UI/UX, Generate UI/UX and Design Fusion now carry
explicitly excluded modules as `[X-...]` trace entries with proposed acceptance
criteria. AI creative additions are rejected if a conservative scope check
detects a proposed prohibited feature. If the provider times out, returns an
unsafe answer, or is rate-limited, the complete deterministic specification
remains available, clearly labeled as guide output. This lexical guard is
not a substitute for human review; review the generated handoff before
implementing or sharing it.

**Verification.** `npm test` includes adversarial feature exclusion,
double-negation, topic classification, score-ledger reconciliation,
refinement persistence and owner isolation, prompt traceability, and
model-output scope tests. Chromium and Firefox E2E tests cover the
refinement form, comparison expansion, reset and existing studio flows.
No database schema migration or additional paid AI provider was required.

