# M08 — Live original-source discovery (14 publishers)

This replaces the hard-coded 15-site suggestion feed. Users enter a design
problem statement, then Frontline searches **only original publisher domains**
using the licensed Brave Search API. Search results contain actual indexed
page URLs and publisher-indexed titles. URL hostnames are strictly allowlisted;
no screenshots, invented names, made-up prompts, or component copies.

## Supported source domains

Animation/components: React Bits, Aceternity UI, Codrops, Animata, Uiverse,
Magic UI, Awwwards.

Design inspiration: Kage, 21st.dev, Refero, Mobbin, Landingfolio, Lapa Ninja,
Page Flows.

Brave index coverage varies by site; all 14 are queried but 14 hits are not
guaranteed. Source pages can disappear or change. Results are marked as indexed,
NOT independently inspected. Restricted publisher content must not be scraped.

## Operator setup

1. Apply the SQL migration under `docs/migrations/frontline_live_source_discovery.sql`
   to the existing **frontline-ux** Supabase project.
2. Obtain an authorized Brave Search API subscription and set the server-only
   `FRONTLINE_BRAVE_SEARCH_API_KEY` in Render. Do not use a frontend `VITE_*`
   environment variable. Search incurs provider cost/quotas.
3. Run unit tests and a **real search** for at least one test brief, visit
   returned original pages and verify titles/links manually.
4. Check source selection persistence in PostgreSQL, two-account isolation and
   restored design boards on two devices; monitor request quotas/rate limiting.
5. Confirm publisher permissions before any further prompt/code reuse.

### Exact original publisher prompts (important)

The user requires **the publisher's own prompt, not a Frontline paraphrase**.

The Brave Search API indexes URLs/titles; it does NOT provide licensed access
to exact original Kage, 21st.dev or other publisher prompt content. Frontline
therefore shows an **Open original source** link and a clear
`Original publisher prompt: Not verified for reproduction` statement.
The old Select-mode `POST .../inspirations/prompt` route now rejects with
409, not a Frontline-generated fake. The separate Generate UI/UX and Design
Fusion modes can still produce Frontline-original design prompts and must
continue to label them accordingly.

To display complete original prompts inside Frontline, obtain the publisher's
explicit permission and an official authorized retrieval API, implement
source-exact verification and attribution, and pass content-rights checks.
Never copy gated material by scraping a screenshot, page, or MCP response.

### Privacy

Only up to seven sanitized keywords are sent to the search-index provider,
never full chats, account identifiers or user feedback. The source index cache
is short-lived (8 minutes) and key-dependent. Render's default API rate limits
still apply. Unconfigured/failing providers return no invented recommendations;
a clearly labeled directory links to original site homepages.

Reference:
https://api-dashboard.search.brave.com/documentation/services/web-search
