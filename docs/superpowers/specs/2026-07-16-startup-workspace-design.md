# Startup Workspace Design

## Goal

Turn the existing founder and institution screen mockups into a persistent, role-separated startup-support product covering preparation, diagnosis, collaboration, conversion, settlement submission, and institution review.

## Product boundaries

- Roles are `pre_founder`, `founder`, and `manager`.
- Preparation data (tasks, comments, eligibility answers, diagnosis details, drafts, and vault contents) belongs to the founder team and is never available to managers.
- Managers may view only founder submissions that have passed pre-validation and have been submitted for review.
- The product does not provide real-time chat, a generic file drive, an open team-building marketplace, legal brokerage, or K-Startup submission replacement.
- Every automated diagnosis is labelled as reference-only; tax and legal surfaces keep their required non-advisory notice.

## Architecture

The existing Next.js application remains a single app. Existing `/founder/*`, `/workspace/*`, and `/manager/*` paths remain their separate user-facing surfaces. A server-side workspace repository and API routes provide all reads and mutations. Supabase is the persistence and authorization boundary; browser components never decide access rights themselves.

The startup workspace schema is appended to `supabase/schema.sql`. Tables are grouped around a team: programs, preparation teams/projects, members, tasks/comments, document versions, diagnostic reports/credits, conversion codes, founder teams, submissions/reviews, leads, waitlist entries, and event logs. Supabase RLS permits a signed-in user to access only their own team data. Institution users can access only submissions whose status is `validated` or later and whose team is attached to their institution.

Core domain calculations are pure TypeScript modules with Vitest coverage. Pages call repository/API functions, then render the existing design components using persisted data. This makes the business rules independently testable and prevents UI state from becoming the source of truth.

## Data flow

1. A newly registered user selects founder or manager. Founders complete profile, team, programs, item, and optional team-building intent; managers supply a valid institution credential.
2. Founder onboarding creates a preparation team, program subscriptions, and automatic D-14/D-10/D-7/D-1 tasks. It then runs the deterministic eligibility rules for each selected program and stores the report plus events.
3. Team members manage persisted task states, ownership, ordering, comments, calendar events, documents, and document versions. The founder home endpoint aggregates closest deadline, three open tasks, diagnostic summary, and completion progress in one query path.
4. Calculator and resource-download flows collect consented leads. Connect only records real waitlist registrations; it displays no fabricated count. The incorporation guide keeps the partner contact form disabled until a partner is configured.
5. Plan diagnosis consumes validated text input or a vault document reference, enforces monthly credits, saves PSST and SWOT results as a version-linked report, and returns the credit when processing fails. Its output is diagnostic, not a prediction or writing service.
6. A valid, unused institution conversion code upgrades a preparation team inside a database transaction. The transaction records a snapshot, creates/links the founder team, transfers documents and members, changes role to `founder`, and emits conversion events. Preparation-only data remains inaccessible to managers afterwards.
7. Founders submit only pre-validated settlement records. Managers see that controlled submission queue, issue a reasoned decision, manage their conversion codes, and view institution-level aggregate counts without founder preparation content.

## Error handling and safety

- Missing Supabase configuration gives a clear disconnected-state message and never silently treats mock data as production data.
- Program selection is optional; home, TODO, and calendar show a guided empty state until a program is added.
- Unknown or unconfigured rulesets are represented as `pending`, not eligible or ineligible.
- Automatic milestones are hidden rather than destructively deleted; deadline changes recalculate only automatic tasks.
- Invalid, expired, rate-limited, or already-used conversion codes do not modify team state.
- Document parsing rejects unsupported, oversized, or unavailable content with an actionable fallback; file-storage operations are contained to the vault folders.
- Managers are denied by RLS and server checks even if they call an API directly.

## Testing strategy

- Unit tests cover eligibility outcomes, recommendations, milestone creation/recalculation, D-day thresholds, tax calculations, credit limits, conversion validation, and manager visibility.
- API tests cover role checks and mutation validation where the environment permits a test database; repository interfaces remain mockable for isolated tests.
- Supabase SQL includes RLS policies that encode the manager visibility boundary.
- Final verification runs the focused Vitest suite, the full test suite, ESLint, and a production Next.js build.

## Delivery phases

Implementation follows the product document's dependency order while delivering the complete requested scope:

1. Foundation: schema/RLS, roles, routing gates, onboarding, eligibility, events, calculator.
2. Preparation workspace: persistent home, TODO/comments, calendar, vault/versioning, conversion.
3. Diagnostic and guidance: business-plan diagnosis/credits/history, incorporation guide and consent-safe lead capture.
4. Institution experience: conversion-code administration, submitted-item review queue, aggregate reports, and connect waitlist.

