# OpenRouter GLM Business-plan Diagnosis Design

## Goal

Provide a real, founder-only business-plan diagnosis using OpenRouter's `z-ai/glm-5.2` model, returning persisted PSST and SWOT results without exposing the provider key or presenting a selection prediction.

## Request flow

The browser sends confirmed business-plan text or a vault document identifier to a Next.js route. The route authenticates the user, verifies membership in the document's preparation team, enforces the monthly credit balance and input size, then calls OpenRouter from the server with `OPENROUTER_API_KEY`. The key is never placed in `NEXT_PUBLIC_*` configuration or returned to the browser.

The request uses `POST https://openrouter.ai/api/v1/chat/completions`, model `z-ai/glm-5.2`, non-streaming output, low temperature, and a strict JSON Schema response. The schema requires four PSST dimensions (problem, solution, scale_up, team), each with a 0–25 score and source-grounded evidence; two or more practical actions; and four SWOT lists. It expressly prohibits eligibility, funding, or selection predictions.

## Persistence and failure handling

Before the provider call, the route computes available credits from the monthly free allocation and accepted-invite credits. It does not insert a debit until the provider response is valid JSON and the `diagnosis_reports` row has been saved. Provider errors, malformed output, unsupported files, overlong text, or database write errors return an actionable error and leave credits unchanged.

On success, the route writes a `bizplan` report linked to the vault document when supplied. `result` stores the structured report and provider metadata (model, OpenRouter generation id, input/output token counts). It writes one debit ledger item and emits `bizplan_diagnosis_run`. Existing RLS permits only preparation-team members to read the report; managers receive no report access policy.

## UI and configuration

The diagnostics screen gains a text area, an optional document reference field, an execute button, loading/error states, and a data-fed A1 report. The screen always shows “AI 추정·참고용이며 합격 또는 선정 결과를 보장하지 않습니다.”

`.env.local` requires:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=z-ai/glm-5.2
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Verification

Unit tests mock the provider boundary to prove a valid result is saved and charged exactly once; malformed provider output is rejected without a debit; and the request payload never exposes the key. Route tests cover unauthenticated, over-limit, and oversized-input errors. Final checks run lint, all Vitest tests, and production build.
