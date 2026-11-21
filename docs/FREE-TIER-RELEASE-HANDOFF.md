# Frontline free-only release handoff (2026-11-21)

## Non-negotiable operator decision
**₹0 additional spending for now.** No payment, subscription, AI credits, or production-use license may be enabled automatically. Provider free quotas can be exhausted, and that may temporarily reduce AI quality. Return honestly labelled source metadata and a deterministic original design prompt; never claim an unavailable model reviewed content.

## What is already technically validated
- Branch: `qa/full-release-acceptance-gate-20261120`, draft [PR #71](https://github.com/shivamani0426/ui-ux-/pull/71). **Do not merge or deploy until release checklist passes.**
- GitHub Actions securely received **GROQ_API_KEY** and **NVIDIA_API_KEY**, and separately demonstrated live Groq and NVIDIA semantic model replies.
- Isolated PostgreSQL acceptance covered first-party publisher links, semantic source review, explicit Yes and unchanged original links, publisher component review, private message persistence, and deletion of synthetic test data.
- Simulated Groq HTTP 503 successfully routed to actual NVIDIA evaluation with user-content transfer explicitly enabled *in staging only*.
- Tests cover 360/390/430px simulated touch layouts in Chromium and Firefox, not real Android-device QA.
- Any irrelevant component may correctly receive `semantic-rejected`; the Yes action must still return an explicitly Frontline-authored usable design prompt and never invent original-publisher links.
- Upstream Groq 429/billing-required and hosted NVIDIA trial production-use restrictions remain genuine external limits, not code defects.

## Free-only production plan
- Primary: **Groq** (`AI_PRIMARY_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b`).
- Default: **no AI cross-provider fallback** (`AI_FALLBACK_ENABLED=false`). NVIDIA's hosted trial is **staging-only**; never send real production user prompts to it under an evaluation key.
- The old OpenRouter code remains temporarily for the *existing deployed revision*. Its key is not required by the new Groq-only candidate; remove the legacy dependency and secret only after the exact new live revision and rollback are verified.
- Never use `OPENROUTER_MODEL=openai/gpt-4o-mini` or another paid model as a silent default.
- GitHub Actions repository secrets are not Render runtime secrets. Do not attempt to read, paste, print, or copy credentials into source files.
- All provider API calls are server-side and must remain bounded, privacy-preserving, and safely error-classified.

## Operator steps for the next session (account screens)
1. Confirm `GROQ_API_KEY` is available in **Render → ui-compass-studio → Environment**, stored as a secret (not a `VITE_` variable). Do not share the key in chat.
2. At release time configure `AI_PRIMARY_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b`, `AI_FALLBACK_ENABLED=false`. **Do not set NVIDIA_API_KEY in Render with a trial key.**
3. Confirm the Groq free quota currently supports real acceptance. If insufficient, **do not enable billing**: reduce usage, wait for permitted reset, or explicitly accept a limited free beta with honest degraded responses.
4. Inspect all PR #71 checks. Production-baseline AI acceptance is expected to be red **until** the exact candidate SHA is deployed, because the old production revision still uses OpenRouter.
5. Stage or deploy with rollback available only after the candidate checks and operator approval; verify actual build SHA, health/database, one real fictional brief, original publisher URLs, explicit Yes and component honesty, source persistence, browser/mobile behavior, and synthetic account cleanup.
6. Once the new provider route passes live acceptance and a rollback route exists, retire OpenRouter from Render and then remove its code, tests, paid model presets and historical defaults in a separate reviewed cleanup. Do not remove it while an active revision still needs it.

## Actual blockers after this handoff
1. **Groq free capacity** is rate-limited and may show `429 billing-required`; free service cannot guarantee arbitrary public load.
2. **NVIDIA developer-trial production authorization** is not granted. Leave it for staging; no automatic license switch or payment.
3. **Render secret and provider settings** need the operator's account-screen action.
4. **Safe migration from live OpenRouter** requires deployment approval, revision verification and rollback.
5. **Final live acceptance** cannot pass before the exact new revision is deployed.

No account payment, production environment mutation, merge, or deployment has occurred as part of this handoff.

## CI budget protection
- While PR #71 is **draft**, free-quota-consuming real Groq, NVIDIA and current-production baseline checks are intentionally **skipped** on ordinary edits; build, unit, publisher-fixture, PostgreSQL and Chromium/Firefox smoke tests continue.
- A **ready-for-review** transition (GitHub PR screen) or an authorized `workflow_dispatch` triggers those real integration checks for the candidate. **Do not mark ready unless you intend to consume a few free inference calls.**
- When the PR is marked ready, live-baseline acceptance may still be red because main is still the old OpenRouter deployment. The new deployed SHA must be checked after the controlled release; never treat a skipped or expected-red job as proof of production readiness.
