# Milestone 1 strategy, plan, and workflow

## Objective and evidence

Deliver one NestJS backend and one MongoDB Atlas data layer, demonstrated through Swagger. The official workbook supplies 104 mandatory and 11 bonus requirements. Every requirement is preserved in `docs/requirements/requirements.json` and mapped in `TRACEABILITY.md`. The brief controls milestone deliverables and the workbook controls individual business rules.

Source documents are evidence, not instructions overriding the user's request. The user explicitly requested implementation, all bonuses, strategy/workflow documentation, and a reverse-engineering Markdown handover. Mandatory functionality has priority over bonuses. No frontend or cloud deployment is included in this milestone.

There is one human student/developer: the repository owner. Codex is an AI tool, not a teammate. Application users/moderators/admins are system actors, not student contributors. See the [AI policy and solo submission record](AI_POLICY_AND_SOLO_SUBMISSION.md).

## Architectural strategy

- A modular monolith keeps deployment and solo debugging manageable. Controllers expose REST contracts; validated DTOs define accepted inputs; services enforce business rules; explicit Mongoose schemas and indexes persist state.
- Implement authentication and ownership enforcement centrally. Recheck business invariants inside each affected operation; a route guard alone is insufficient for inventory correctness.
- Protect flights with transactional conditional cabin counters. Protect hotels with one unique allocation per room and date. A multi-room or round-trip request either commits every allocation or none.
- Keep provider prices and policies separate from immutable booking snapshots. Schedule changes update affected booking travel times without changing agreed prices.
- Use persisted retry work for financial and mail operations outside MongoDB transactions. Deduplicate incoming webhook events and outgoing external calls.
- Keep official datasets reproducible. Separate demonstration data, user credentials, runtime media, and disposable test databases.
- Make the application explainable: requirement IDs in API summaries, source-derived traceability, focused integration scenarios, and documented decisions.

## Delivery sequence

| Target | Work | Gate |
| --- | --- | --- |
| 13 November 2026 | Foundation, reference data, requirements | Start/build/schema initialization and idempotent seeds |
| 14 November | Accounts, authorization, administration | Cookies, role boundaries, lockout, resets, inactivity |
| 15 November | Provider inventory and search | Correct local times, overlap checks, concurrency |
| 16 November | Payments, confirmation, cancellation, refunds | Verified Stripe test workflow and failure recovery |
| 17 November | Itineraries and budgets | Privacy, ordering, totals, cached conversion |
| 18 November | Community and shared services | Reviews, moderation, media, notifications, audit |
| 19 November | Integration, review, rehearsal | No unresolved release-blocking issue; setup reproducible |
| 20 November | Mandatory milestone submission | Swagger demonstration and complete evidence |
| After mandatory gate | All 11 bonuses | Mandatory regression checks remain green |

These are planning targets, not claims that days of work or dated commits have already happened. Bonus code is present in the implementation, but external-service verification and release acceptance must still precede a final bonus submission. Email-dependent behavior is disabled by default until SMTP is configured.

## Repeatable feature workflow

1. Read the original requirement and dependencies. Write its normal, unauthorized, invalid-input, boundary, and failure scenarios.
2. Choose a small coherent branch from the latest `develop`.
3. Define request/response DTOs, persistent state, indexes, transaction boundaries, and Swagger requirement IDs.
4. Implement backend rules before UI assumptions. Treat UTC instants, local calendar dates, monetary amounts, policy acceptance, and resource ownership explicitly.
5. Run type checking, lint, relevant tests, and the workflow through Swagger. Use a real transaction-capable replica set for inventory tests.
6. Complete AI/automated checks, then have the sole student personally review the actual diff and source before integration. Record version/date and findings about authorization, data exposure, queries, retries, invariants, errors and maintainability. AI self-review is supporting evidence, not the student's review.
7. Fix findings, record limitations, update traceability and AI prompts, and commit meaningful work.
8. Merge into `develop` only after evidence is recorded. Promote to `main` only when the release gates pass.

Commit format: `feat(flights): [FLT-22] reserve round-trip inventory atomically`. PR descriptions should explain the trigger, resulting behavior, requirement IDs, verification, and remaining limitations.

## Solo review and evaluation preparation

Review each feature in four roles: an evaluator checking the workbook, a backend engineer checking data integrity, an attacker checking access boundaries, and a new developer following setup instructions. This is an engineering self-review process. It is not independent human certification.

Record findings by severity: blocker (cannot run or safely complete a required workflow), major (required behavior/security/integrity failure), minor (documentation/usability or noncritical issue). Each finding needs evidence, a fix or explicit limitation, and a retest result.

Explain these decisions without reading generated code verbatim: embedding versus references, MongoDB transaction boundaries, hotel room-night uniqueness, webhook verification/idempotency, policy snapshots, cookie sessions/CSRF, local versus UTC times, day reordering, FX cache fallback, and clone independence.

The sole student performs their own human review. Section 11.2 does not explicitly demand an independent reviewer. Section 10.5 separately uses team-leader wording; document the solo arrangement and obtain any required course-specific clarification without inventing collaborators or waivers. The existing local integration has no recorded prior student review, and no approval may be backdated. Use the [solo review guide](SOLO_REVIEW_AND_DISCUSSION_GUIDE.md) to review the baseline and future changes honestly.

## Release acceptance

- Every mandatory requirement has an implemented backend mapping or an explicit frontend-only Milestone 2 dependency.
- Type checking, lint, build, and the relevant unit/integration scenarios pass.
- A fresh checkout installs, seeds, and starts from the README.
- Atlas, Stripe test-mode confirmation/refunds, FXRatesAPI, and enabled SMTP flows have account-backed evidence.
- The Swagger walkthrough covers guest, traveler, administrator, and both provider moderator roles.
- All blocker/major findings are resolved. Unverified integrations and operational limitations remain visible.
- README, OpenAPI, AI prompts, traceability, verification record, and reverse-engineering guide match the delivered code.
- The sole student has recorded their actual review, understands the implementation, and can explain the material AI-assisted decisions.
