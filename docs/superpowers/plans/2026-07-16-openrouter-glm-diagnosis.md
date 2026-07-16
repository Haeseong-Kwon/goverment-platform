# OpenRouter GLM Diagnosis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, persisted GLM 5.2 business-plan diagnosis flow through OpenRouter.

**Architecture:** A server-only provider module calls OpenRouter with strict JSON Schema. The authenticated route owns authorization, credit accounting, persistence, and response mapping; the founder screen only submits text and renders saved structured data.

**Tech Stack:** Next.js Route Handlers, TypeScript fetch, OpenRouter Chat Completions, Supabase, Vitest.

---

### Task 1: Provider contract and structured-output parser

**Files:**
- Create: `src/lib/ai/openrouter.ts`
- Create: `src/lib/ai/openrouter.test.ts`

- [ ] **Step 1: Write the failing parser test**

```ts
it("accepts all four PSST sections and SWOT", () => {
  expect(parseDiagnosis(JSON.stringify(validDiagnosis))).toMatchObject({
    psst: { problem: { score: 20 }, team: { score: 15 } },
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/ai/openrouter.test.ts`

Expected: FAIL because the provider module does not exist.

- [ ] **Step 3: Implement the provider**

Export `runBizplanDiagnosis(text: string)`. Require `OPENROUTER_API_KEY`; call `https://openrouter.ai/api/v1/chat/completions` with `model: process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2"`, `temperature: 0.2`, `stream: false`, and strict `response_format.json_schema`. Parse the first choice only, reject invalid JSON/schema, and return report plus generation id and usage. The system prompt must request evidence from supplied text only and prohibit selection predictions.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/ai/openrouter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/openrouter.ts src/lib/ai/openrouter.test.ts
git commit -m "feat: add OpenRouter GLM diagnosis provider"
```

### Task 2: Authenticated diagnosis route and credit ledger

**Files:**
- Create: `src/app/api/workspace/diagnoses/bizplan/route.ts`
- Create: `src/app/api/workspace/diagnoses/bizplan/route.test.ts`
- Modify: `src/lib/services/WorkspaceService.ts`

- [ ] **Step 1: Write failing route tests**

```ts
it("does not debit when the provider returns malformed content", async () => {
  expect((await POST(malformedProviderRequest())).status).toBe(502);
  expect(creditDebit).not.toHaveBeenCalled();
});
it("saves report then writes one debit", async () => {
  expect((await POST(validRequest())).status).toBe(201);
  expect(creditDebit).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/workspace/diagnoses/bizplan/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement authorization, limits, and persistence**

Reject missing authentication, text longer than 40,000 characters, a document outside the caller's prep team, and exhausted credit balance. Call the provider only after validation. Insert `diagnosis_reports` with `report_type: "bizplan"`, then insert one negative `diagnosis_credits` record and a `bizplan_diagnosis_run` event. Return the saved report without API key or raw provider request.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/app/api/workspace/diagnoses/bizplan/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workspace/diagnoses/bizplan src/lib/services/WorkspaceService.ts
git commit -m "feat: persist GLM business-plan diagnoses"
```

### Task 3: Founder diagnosis UI and final verification

**Files:**
- Modify: `src/features/startup-workspace/components.tsx`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add a UI behavior test or focused component test**

```ts
it("shows the reference-only disclosure with a completed result", () => {
  expect(renderDiagnosis(validReport).getByText(/참고용/)).toBeDefined();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/startup-workspace/diagnosis-ui.test.tsx`

Expected: FAIL before the result component exists.

- [ ] **Step 3: Implement the screen**

Replace the mock diagnosis panel with text input, optional document id, submit/loading/error states, saved report rendering, PSST scores, evidence, actions, SWOT, model name, and the fixed reference-only disclosure. Add only placeholder names to `.env.example`; never add a secret.

- [ ] **Step 4: Verify release**

Run: `npm run lint && npm test && npm run build`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/startup-workspace/components.tsx .env.example README.md
git commit -m "feat: connect founder UI to GLM diagnosis"
```

