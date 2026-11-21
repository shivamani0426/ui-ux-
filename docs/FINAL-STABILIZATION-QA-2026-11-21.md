# Frontline UX/UI final stabilization QA — November 21, 2026

## Goal and scope
A **single stabilization upgrade** of the existing Frontline UX/UI project. No feature expansion, redesign, paid-provider activation, new hosting, or payment authorization. Preserve the previous live revision until candidate checks are green.

## Proven fixes in PR #71
- Fix malformed or percent-encoded guest cookies throwing before the server's error handler and potentially terminating the Node HTTP request.
- Preserve existing saved chat history rather than silently slicing conversations down to the most recent 24 messages. New 200-message limit rejects further writes explicitly and preserves prior history.
- Protect PostgreSQL and development-memory chat updates with compare-and-set so concurrent tabs cannot silently overwrite completed replies.
- Reject oversized JSON request bodies and safely decode UTF-8 across streamed network chunks.
- Verify PostgreSQL with a real bounded `SELECT 1` before reporting a healthy database; return 503/degraded if the query fails.
- Prevent duplicate rapid chat submissions and stale responses overwriting a newly opened project.
- Show Groq rather than misleading OpenRouter retry guidance when Groq is configured; preserve provider name on fallback replies.
- Retain the prior same-provider, bounded GPT-OSS empty-content retry and structured-response handling.

## Verification and evidence
- JavaScript unit/backend suite: **288 tests, 286 passed, 0 failed, 2 intentionally skipped** on candidate `818d4fa39de561690910ec611c663be8da1aac41` prior to this workflow-only commit.
- Verified regression scenarios: malformed cookie input, >24 chat turns retained, parallel chat requests don't lose successful messages, split multibyte UTF-8 input, oversized JSON 413, and correct UI provider naming.
- Real PostgreSQL integration, real publisher discovery in isolated staging, Chromium and Firefox browser smoke, and 360/390/430px viewports passed on candidate.
- Previous exact Groq-only staging revision `b9cc701` passed real source evaluation, three genuine publisher URLs, five AI-matched components, Yes flow, private persistence and cleanup. Subsequent stabilization changes require fresh release acceptance before claiming the new SHA passed real AI E2E.
- Previously witnessed Groq `HTTP 429 billing-required` during a separate trial. This is an upstream free-tier limit, not solvable or guaranteed by code; paid service **not** enabled.
- Production verification remains a **post-deployment** check on the exact live Git SHA; the old deployed version is not a valid acceptance proxy for the new commit.

## Cost, privacy and manual release gates
- Production Groq primary `AI_PRIMARY_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b`, `AI_FALLBACK_ENABLED=false`; no trial NVIDIA production key and no paid service.
- Only the **Groq-only full candidate Yes/persistence gate** auto-runs when the release PR is marked ready. All other real-provider and old-production acceptance tests require explicit manual dispatch. This avoids repeatedly consuming free provider quota and avoids red pre-deployment tests that inspect stale production.
- Do not interpret a successful HTTP 200 or a verifiable publisher link alone as proof that the AI completed semantic evaluation. Require `sourceReview=semantic-evaluated`, component review proof, owner-scoped persistence, and cleanup in the full test.
- A conservative publisher metadata fallback and a clear 'no verified reference' result are acceptable; source or component URLs and publisher-authored prompts must never be fabricated.

## Release sequence
1. Confirm all default offline/backend/PostgreSQL/browser workflows green on this exact branch commit.
2. Mark PR #71 ready; verify the sole automatically executed real Groq-only full staging gate without cross-provider fallbacks.
3. Only then merge into `main`; Render auto-deploys the same existing public site.
4. Verify Render deploy status and exact `/api/health` commit; `/api/config` must show Groq with fallback off and database connected.
5. Run one synthetic, private, disposable public-design and Yes/persistence/cleanup check. If Groq is temporarily rate-limited, record it as **not verified** rather than switching to paid inference.
6. Keep old deployment rollback available until the newly deployed revision is validated. Never delete original data or credentials as part of this patch.

## Not certified
No claim of absolute absence of bugs, native Android/iOS-device coverage, exhaustive OAuth provider integration, unlimited Groq uptime, free-tier load capacity, or clinician review. These require separate evidence; none should be invented.
