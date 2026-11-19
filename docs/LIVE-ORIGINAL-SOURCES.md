# M08 — Genuine original-source links and publisher prompts

Status: **Kage official MCP end-to-end verified, React Bits official index live**, Aceternity UI official JSON API in PR #55 pending production verification.
Other 11 websites remain directory links until source-specific permitted integrations exist. Avoid implying all 14 sites publish prompts; many only provide
visual inspiration, components or UX research.

## Two source categories

Animation/components: React Bits, Aceternity UI, Codrops, Animata, Uiverse,
Magic UI, Awwwards.

Design inspirations: Kage, 21st.dev, Refero, Mobbin, Landingfolio,
Lapa Ninja, Page Flows.

All 14 have direct ORIGINAL website links, not disguised cloned pages or
invented entries. Only genuine publisher-returned individual pages appear
as AI matches. Currently the official Kage MCP returns genuine matched design URLs and
exact prompts. React Bits is independently linked through its official
https://reactbits.dev/llms.txt index: actual animation/component URLs and
descriptions only, no publisher prompts or republished component source code.
Aceternity UI exposes its original components through the official first-party JSON API at https://ui.aceternity.com/api/components. Its component titles, descriptions and page links can be recommended, but it does not publish original design prompts in that index.
The remaining 11 websites are original publisher directories, not fabricated recommendation cards. 21st.dev has a keyed
MCP endpoint, but its publisher API is NOT yet connected or authorized for
republication in Frontline; do not imply otherwise.

## Live verification evidence

Official Kage endpoint: https://kage.design/mcp
Official setup: https://kage.design/mcp-setup
Publisher terms: https://kage.design/terms

The dedicated GitHub Actions diagnostic runs a live tools/list request,
search_designs, and get_design and requires a URL plus an unmodified
publisher-supplied original prompt before passing. It logs the URL,
byte count, and SHA-256 only, never the full publisher prompt.

- Verified GitHub run 44444456292: success.
- Verified source: https://kage.design/designs/zro-uncensored-security-models-landing-page
- Retrieved publisher prompt: 6043 bytes.
- SHA-256 c07ec585a6f22b24589398f9f3c00643ae7e1f1c0015b7ef51abd9dc74817e13

The integrated Kage adapter dynamically discovers tool input schemas
and extracts prompt text only from the publisher's get_design result.
It never asks Frontline's LLM to write a Kage prompt. No prompt text
is written into PostgreSQL; only selected page titles and URLs are
stored per private project for workspace handoffs.

Kage permits prompts/analyses to be used commercially under its
September 2026 terms, but prohibits bulk scraping/mirroring. Frontline
therefore limits results to three per request, ephemeral 4-minute cache,
and a bounded hourly request budget. Do not collect their entire site
or republish screenshots, branding, logos, or protected web assets.

## Data and privacy

Only up to seven redacted topical search keywords are sent to Kage;
never account identity, private chat history, or feedback. Returned
original URLs are validated against the publisher host. Incorrect
slugs, mismatched get_design URLs, unstructured responses, unavailable
providers, and oversized prompts all fail closed rather than returning
a fake. The SHA-256 check is a testable integrity proof, not an
independent copyright or design-quality certificate.

Kage's own original prompt is displayed under a clearly labeled
expandable detail with an **exact copy** button. It is not mixed into
a generic Frontline original prompt and not silently rewritten.
React Bits and Aceternity component cards link directly to original documentation and explicitly state that no original design prompt was provided by their catalogues.
React Bits uses MIT + Commons Clause; Frontline does not redistribute
component code. Other sites show their original URL until an authorized
source-specific retrieval method is available.

The previous Select endpoint POST /api/projects/:id/inspirations/prompt
returns 409 with original source links instead of fabricating a new
original-publisher prompt. Generate UI/UX and Design Fusion may still
produce Frontline-original design prompts, labeled as such.

## Production rollout gates

1. The backward-compatible Supabase migration
   docs/migrations/frontline_live_source_discovery.sql has been applied
   to project jzlgdxkefabahwecejov. It adds source provenance columns
   WITHOUT disabling legacy rows on the current live production app.
2. Run npm test, Vite build, Chromium+Firefox local E2E, and dedicated
   LIVE Kage MCP diagnostic. Compare exactly deployed Git revision.
3. Test Kage prompt visibility, copy fidelity, save and restore, 2-user
   isolation, privacy and rate limits with real browser sessions.
4. Roll out only after checks are green. Archive old static source rows
   post-release via docs/migrations/frontline_archive_legacy_sources_postrelease.sql,
   not before. Keep user histories safe.
5. Each future site-specific adapter must demonstrate an actual official
   published prompt and reproduction rights, or remain link-only.

## React Bits publisher integration

React Bits official index: https://reactbits.dev/llms.txt.
Frontline requests this public page server-side, parses exact publisher page URLs,
and ranks component names/descriptions against sanitized brief keywords.
Only verified React Bits URLs under /components, /animations, /backgrounds,
and /text-animations qualify. No cloned illustrations or prompt text are invented.
The cached catalogue expires after 12 minutes; an unavailable or malformed
publisher response returns zero fabricated matches. Source links are saved
per user to the existing design workspace. A published component description
is not described as a publisher-written design prompt.

React Bits license: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
(MIT + Commons Clause: do not sell, sublicense or redistribute components
as a library or bundle). Opening the publisher page keeps its own installation
instructions and dependencies visible to the end user.

Release verification: test the live publisher catalogue, URL validation,
owner-scoped save/remove, no fake prompt status and Chrome/Firefox UI cards.

## Aceternity UI original component integration (M08C)

First-party index: https://ui.aceternity.com/api/components. The publisher's
https://ui.aceternity.com/llms.txt explicitly directs AI systems to this JSON API.
Frontline fetches the original catalogue server-side, with no user brief or
private account data in the request. Results are ranked locally against a
brief's keywords. It accepts only original HTTPS documentation links at
https://ui.aceternity.com/components/<publisher-provided-slug> where the
publisher JSON name and URL exactly agree. No external lookalike domains,
unverified slugs, screenshots, media files or component source code are used.

The indexed JSON is cached 10 minutes. Invalid/oversized, inaccessible or
schema-incompatible source responses produce zero invented recommendations.
Original component URLs can be saved in a private project board, but the
records are link metadata only and never claimed as original design prompts.
The original publisher's licensing and install details remain on each linked
source page. These components share the UI explorer with React Bits, but
are labeled and ranked by verified individual publisher provenance.

Production release requires CI unit/security/API tests, live first-party API
verification, real Chromium and Firefox UI tests, a matching Render commit
and post-deploy health checks. No claims about the other 11 sites being
connected are authorized.
