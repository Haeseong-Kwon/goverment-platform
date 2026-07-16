# Startup Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace founder and manager mockups with a secure, persistent startup-workspace workflow from onboarding through institution review.

**Architecture:** Keep the single Next.js app and role-specific routes. Put deterministic business rules in pure feature modules, call a Supabase-backed repository through API routes, and enforce the founder/manager visibility boundary in RLS as well as server authorization. Split the current mock component into focused interactive feature panels driven by real data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase JS, PostgreSQL/RLS, Vitest, ESLint, Tailwind CSS.

---

## File structure

- `supabase/schema.sql` — startup tables, helper functions, RLS policies, and seed program data.
- `src/features/startup-workspace/domain.ts` — roles, program, task, diagnosis, conversion, and submission domain types.
- `src/features/startup-workspace/rules.ts` — deterministic eligibility, milestones, D-day, calculator, credits, and visibility rules.
- `src/features/startup-workspace/rules.test.ts` — unit coverage for all business rules.
- `src/lib/services/WorkspaceService.ts` — authenticated Supabase data access used by browser pages.
- `src/app/api/workspace/*/route.ts` — validation and mutation endpoints.
- `src/features/startup-workspace/components.tsx` — existing design primitives retained, mock panels replaced with data-fed client panels.
- `src/app/founder/*`, `src/app/workspace/*`, `src/app/manager/*` — role-gated routes using the new panels.

### Task 1: Define and test startup workspace domain rules

**Files:**
- Create: `src/features/startup-workspace/domain.ts`
- Create: `src/features/startup-workspace/rules.ts`
- Create: `src/features/startup-workspace/rules.test.ts`
- Modify: `src/features/startup-workspace/logic.ts`
- Modify: `src/features/startup-workspace/logic.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { createMilestones, evaluateEligibility } from "./rules";

describe("workspace rules", () => {
  it("creates D-14, D-10, D-7, and D-1 automatic tasks", () => {
    expect(createMilestones("project-1", new Date("2026-08-20")).map((x) => x.dueDate)).toEqual([
      "2026-08-06", "2026-08-10", "2026-08-13", "2026-08-19",
    ]);
  });
  it("retains missing answer as unchecked", () => {
    expect(evaluateEligibility("yechang-2026", { hasBusinessRegistration: null }).unchecked).toEqual(["사업자등록 여부"]);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/startup-workspace/rules.test.ts`

Expected: FAIL because `./rules` does not exist.

- [ ] **Step 3: Implement domain and minimal rules**

```ts
export type StartupRole = "pre_founder" | "founder" | "manager";
export type TaskStatus = "todo" | "in_progress" | "done";
export interface EligibilityAnswers {
  hasBusinessRegistration: boolean | null;
  hasClosureHistory?: boolean | null;
  hasPriorBenefit?: boolean | null;
  isEmployed?: boolean | null;
  hasCoRepresentative?: boolean | null;
}
const MILESTONES = [["사업계획서 초안 완성", 14], ["증빙 서류 준비", 10], ["발표 리허설", 7], ["최종 제출", 1]] as const;
export function createMilestones(projectId: string, deadline: Date) {
  return MILESTONES.map(([title, days], index) => ({
    id: `${projectId}-${index}`, title, dueDate: new Date(deadline.getTime() - days * 86400000).toISOString().slice(0, 10),
    taskType: "auto" as const, status: "todo" as const, isHidden: false,
  }));
}
```

Implement deterministic rule-set evaluation, cross-program recommendations, D-day tone, calculator, monthly credits, and manager submission visibility. Preserve current `logic.ts` exports as wrappers.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/features/startup-workspace/rules.test.ts src/features/startup-workspace/logic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/startup-workspace/domain.ts src/features/startup-workspace/rules.ts src/features/startup-workspace/rules.test.ts src/features/startup-workspace/logic.ts src/features/startup-workspace/logic.test.ts
git commit -m "feat: add startup workspace domain rules"
```

### Task 2: Add startup schema, conversion transaction, and RLS

**Files:**
- Modify: `supabase/schema.sql`
- Create: `supabase/startup-workspace.rls.test.sql`

- [ ] **Step 1: Write failing SQL policy assertions**

```sql
set local role authenticated;
select set_config('request.jwt.claim.sub', 'manager-user-id', true);
select count(*) = 0 as manager_cannot_read_prep_tasks from workspace_tasks;
```

- [ ] **Step 2: Verify RED**

Run: `supabase test db`

Expected: FAIL before the workspace tables and policies exist. If Supabase CLI is unavailable, run the file in Supabase SQL Editor before deployment.

- [ ] **Step 3: Add schema and access policies**

Create `startup_profiles`, `institutions`, `programs`, `prep_teams`, `prep_team_members`, `prep_projects`, `workspace_tasks`, `task_comments`, `vault_documents`, `diagnosis_reports`, `diagnosis_credits`, `conversion_codes`, `founder_teams`, `settlement_submissions`, `submission_reviews`, `leads`, `waitlist_entries`, and `workspace_events`.

Enable RLS on every startup table. Team members may access their own prep-team records. Managers may select only their institution's `settlement_submissions` where status is `validated`, `in_review`, `approved`, or `rejected`; no manager policy is created for tasks, diagnosis reports, or vault records.

Add a `security definer` `convert_prep_team(code text)` function that locks the code/team, rejects invalid/expired/used codes, snapshots the conversion, creates the founder team, moves members and documents only, marks the code used, upgrades the caller role, and writes conversion events.

- [ ] **Step 4: Verify GREEN**

Run: `supabase test db`

Expected: PASS; manager cannot read prep tasks and sees only institution-scoped allowed submissions.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql supabase/startup-workspace.rls.test.sql
git commit -m "feat: add startup workspace schema and RLS"
```

### Task 3: Add profile-aware authentication and onboarding

**Files:**
- Create: `src/lib/services/WorkspaceService.ts`
- Create: `src/lib/services/WorkspaceService.test.ts`
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/api/workspace/onboarding/route.ts`
- Create: `src/app/api/workspace/onboarding/route.test.ts`
- Modify: `src/lib/services/AuthService.ts`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/workspace-entry/page.tsx`

- [ ] **Step 1: Write failing redirect and onboarding tests**

```ts
it("redirects an incomplete founder to onboarding", () => {
  expect(resolveWorkspaceDestination({ role: "pre_founder", onboardingComplete: false })).toBe("/onboarding");
});
it("creates projects, four tasks, and a report after onboarding", async () => {
  expect(await POST(validOnboardingRequest()).then((r) => r.json())).toMatchObject({
    redirect: "/founder", automaticTasksCreated: 4, reportsCreated: 1,
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/services/WorkspaceService.test.ts src/app/api/workspace/onboarding/route.test.ts`

Expected: FAIL for missing service and route.

- [ ] **Step 3: Implement profile routing and transactional onboarding**

Implement `getStartupProfile`, `resolveWorkspaceDestination`, and `completeOnboarding`. Signup must create a startup profile. Login/session handling routes pre-founders to `/onboarding`, founders to `/workspace`, and managers to `/manager`.

The three-step onboarding form saves name/position/team-building intent, program ids, item/industry, and optional invite. Its route validates a founder role and known programs, creates the prep team/projects, calls `createMilestones`, saves deterministic eligibility reports/recommendations, and logs `onboarding_complete` and `diagnosis_complete`. Missing rulesets return `pending`, never a decision.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/services/WorkspaceService.test.ts src/app/api/workspace/onboarding/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/WorkspaceService.ts src/lib/services/WorkspaceService.test.ts src/app/onboarding src/app/api/workspace/onboarding src/lib/services/AuthService.ts src/app/login/page.tsx src/app/signup/page.tsx src/app/workspace-entry/page.tsx
git commit -m "feat: add role-aware startup onboarding"
```

### Task 4: Implement persistent founder home, TODO, comments, and calendar

**Files:**
- Create: `src/app/api/workspace/home/route.ts`
- Create: `src/app/api/workspace/tasks/route.ts`
- Create: `src/app/api/workspace/tasks/[taskId]/route.ts`
- Create: `src/app/api/workspace/tasks/[taskId]/comments/route.ts`
- Create: `src/app/api/workspace/tasks/route.test.ts`
- Modify: `src/features/startup-workspace/components.tsx`
- Modify: `src/app/founder/page.tsx`
- Modify: `src/app/founder/todo/page.tsx`
- Modify: `src/app/founder/calendar/page.tsx`

- [ ] **Step 1: Write failing task tests**

```ts
it("hides an automatic task instead of deleting it", async () => {
  expect(await PATCH(autoTaskRequest({ isHidden: true })).then((r) => r.json())).toMatchObject({ taskType: "auto", isHidden: true });
});
it("forbids a task mutation by a non-member", async () => {
  expect((await PATCH(nonMemberRequest())).status).toBe(403);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/workspace/tasks/route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement endpoints and panels**

Create a home aggregate returning nearest deadline, first three active tasks, latest eligibility summary, and visible completion ratio. Implement task creation, status/assignee/order update, hide-only behavior for automatic tasks, deletion only for custom tasks, and object-scoped comments. Log `todo_complete` only when a task first enters `done`.

Replace static TODO cards in `components.tsx` with client panels loading these routes. Calendar maps persisted program deadlines to red, automatic task milestones to blue, and custom tasks to slate. Empty program state explicitly prompts the user to select a program.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/app/api/workspace/tasks/route.test.ts src/features/startup-workspace/rules.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workspace/home src/app/api/workspace/tasks src/features/startup-workspace/components.tsx src/app/founder/page.tsx src/app/founder/todo/page.tsx src/app/founder/calendar/page.tsx
git commit -m "feat: persist founder tasks and calendar"
```

### Task 5: Implement calculator, lead capture, and vault versions

**Files:**
- Create: `src/app/api/workspace/leads/route.ts`
- Create: `src/app/api/workspace/vault/route.ts`
- Create: `src/app/api/workspace/vault/[documentId]/versions/route.ts`
- Create: `src/features/startup-workspace/calculator.test.ts`
- Modify: `src/features/startup-workspace/rules.ts`
- Modify: `src/features/startup-workspace/components.tsx`
- Modify: `src/app/founder/calculator/page.tsx`
- Modify: `src/app/founder/vault/page.tsx`

- [ ] **Step 1: Write failing calculator and vault tests**

```ts
it("separates employer and worker insurance burden", () => {
  expect(calculateInsurance({ monthlySalary: 3000000, people: 1, accidentRate: 0.007 }).employerTotal).toBeGreaterThan(0);
});
it("creates an immutable version in a fixed vault folder", async () => {
  expect((await POST(vaultVersionRequest())).status).toBe(201);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/features/startup-workspace/calculator.test.ts`

Expected: FAIL until calculator export and vault endpoint exist.

- [ ] **Step 3: Implement limited document and lead flows**

Add year-versioned 2026 rate data, three calculator modes, itemized employer/worker results, and the required non-advisory notice. Create a lead only after valid email plus explicit consent; log `calc_pdf_email_submitted`. Limit vault folders to `bizplan`, `evidence`, and `submission_archive`; every upload creates an immutable version. Resource downloads log `resource_download`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/features/startup-workspace/calculator.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workspace/leads src/app/api/workspace/vault src/features/startup-workspace/rules.ts src/features/startup-workspace/calculator.test.ts src/features/startup-workspace/components.tsx src/app/founder/calculator/page.tsx src/app/founder/vault/page.tsx
git commit -m "feat: add calculator leads and vault versions"
```

### Task 6: Implement business-plan diagnosis, guide, and connect demand capture

**Files:**
- Create: `src/app/api/workspace/diagnoses/bizplan/route.ts`
- Create: `src/app/api/workspace/diagnoses/bizplan/route.test.ts`
- Create: `src/app/api/workspace/waitlist/route.ts`
- Create: `src/app/api/workspace/legal-leads/route.ts`
- Modify: `src/app/founder/diagnostics/page.tsx`
- Modify: `src/app/founder/incorporation/page.tsx`
- Modify: `src/app/founder/connect/page.tsx`
- Modify: `src/features/startup-workspace/components.tsx`

- [ ] **Step 1: Write failing diagnosis tests**

```ts
it("returns a credit when document parsing fails", async () => {
  expect(await POST(invalidDocumentRequest()).then((r) => r.json())).toMatchObject({ charged: false });
});
it("allows only one waitlist row per user and tab", async () => {
  expect((await POST(teamBuildingRequest())).status).toBe(201);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/workspace/diagnoses/bizplan/route.test.ts`

Expected: FAIL because the diagnosis endpoint is missing.

- [ ] **Step 3: Implement bounded diagnosis and safe guidance**

Accept only confirmed text or a vault-document reference, reject unsupported/oversized input, enforce two monthly credits plus invite credits, and decrement after report persistence only. Save four PSST scores, evidence snippets, weak actions, SWOT, and version link. Label output “AI 추정·참고용” and never “합격 예측”.

Render the five incorporation steps. Display a red eligibility warning for programs where incorporation can affect eligibility. Disable the legal contact form unless a partner is configured; require third-party-sharing consent when it is enabled. Persist only real waitlist registrations for team-building, mentor, and investment; show no fabricated counts.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/app/api/workspace/diagnoses/bizplan/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workspace/diagnoses src/app/api/workspace/waitlist src/app/api/workspace/legal-leads src/app/founder/diagnostics/page.tsx src/app/founder/incorporation/page.tsx src/app/founder/connect/page.tsx src/features/startup-workspace/components.tsx
git commit -m "feat: add business-plan diagnosis and demand capture"
```

### Task 7: Implement conversion, founder submission, and manager review

**Files:**
- Create: `src/app/api/workspace/conversion/route.ts`
- Create: `src/app/api/workspace/conversion/route.test.ts`
- Create: `src/app/api/workspace/submissions/route.ts`
- Create: `src/app/api/manager/conversion-codes/route.ts`
- Modify: `src/app/api/manager/review-requests/route.ts`
- Modify: `src/app/api/manager/review-requests/route.test.ts`
- Modify: `src/app/founder/convert/page.tsx`
- Modify: `src/app/workspace/page.tsx`
- Modify: `src/app/workspace/precheck/page.tsx`
- Modify: `src/app/workspace/tracker/page.tsx`
- Modify: `src/app/manager/page.tsx`
- Modify: `src/app/manager/review/page.tsx`
- Modify: `src/app/manager/teams/page.tsx`
- Modify: `src/app/manager/reports/page.tsx`
- Modify: `src/app/manager/settings/page.tsx`
- Modify: `src/features/startup-workspace/components.tsx`

- [ ] **Step 1: Write failing conversion and isolation tests**

```ts
it("converts a team once and returns the founder route", async () => {
  expect(await POST(validCodeRequest()).then((r) => r.json())).toMatchObject({ redirect: "/workspace" });
});
it("does not serialize preparation fields for a manager", async () => {
  const body = JSON.stringify(await GET(managerRequest()).then((r) => r.json()));
  expect(body).not.toMatch(/diagnosis|task|vault/i);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/app/api/workspace/conversion/route.test.ts src/app/api/manager/review-requests/route.test.ts`

Expected: FAIL until repository-backed conversion and review endpoints are present.

- [ ] **Step 3: Implement founder conversion and manager DTOs**

Use only the `convert_prep_team` database function. The conversion page supplies controlled input, confirmation, loading/error feedback, and redirect; invalid/expired/used codes do not alter state. Preserve prep diagnostics, TODO, and drafts as founder-only records.

Persist settlement precheck input using the existing `validateSettlement` rule. Permit review requests only after pre-validation; include status history in the founder tracker. Manager endpoints require `manager` role, issue expiring single-use codes, list only allowed institution submissions, and return only id, team display name, program, requested amount, validation/review state, dates, and feedback. Render real queue, decisions, code administration, and aggregate reports.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/app/api/workspace/conversion/route.test.ts src/app/api/manager/review-requests/route.test.ts src/features/administration-simulator/logic.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/workspace/conversion src/app/api/workspace/submissions src/app/api/manager src/app/founder/convert/page.tsx src/app/workspace src/app/manager src/features/startup-workspace/components.tsx
git commit -m "feat: add conversion and institution review workflow"
```

### Task 8: Integrate and verify the release

**Files:**
- Modify: `README.md`
- Modify: `src/app/workspace-entry/page.tsx`

- [ ] **Step 1: Add manual acceptance checklist**

```md
1. Create a founder, complete onboarding, and confirm four milestones plus an eligibility report.
2. Create/complete a custom task and comment; confirm home and calendar update.
3. Save a vault version, convert with an institution code, and confirm founder navigation.
4. Sign in as a linked manager; confirm only validated submissions appear and preparation data remains unavailable.
```

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: PASS with zero failures.

- [ ] **Step 3: Run static verification**

Run: `npm run lint && npm run build`

Expected: both commands exit 0.

- [ ] **Step 4: Validate RLS and the four acceptance flows in a Supabase test project**

Run: `npm run dev`

Expected: direct manager queries for preparation tables fail by RLS and all README checklist flows work.

- [ ] **Step 5: Commit verification guide**

```bash
git add README.md src/app/workspace-entry/page.tsx
git commit -m "docs: add startup workspace acceptance guide"
```

