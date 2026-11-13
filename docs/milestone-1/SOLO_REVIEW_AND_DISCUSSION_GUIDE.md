# Solo student review and discussion guide

You are the only human student/developer. This guide supports your own review under section 11.2; it does not assume another teammate. Every box is intentionally unchecked. Mark it only after doing the work and understanding the implementation.

## Record the actual version

Run `git rev-parse HEAD` and review that version and its material AI contributions. AI self-review and tests support your review; they do not certify it.

Commit reviewed: **Pending your entry**

Your student identity and actual review date: **Pending your entry**

## Explain the implementation

| Source | Questions to answer and demonstrate |
| --- | --- |
| [Modules](../../backend/src/app.module.ts) | How do controllers, DTOs, services and models implement MVC? Why one backend and database? |
| [Schemas](../../backend/src/database.ts) | Why embed cabins/days but reference bookings/comments? What do transactions and unique indexes guarantee? |
| [Authentication](../../backend/src/auth/auth.ts) | Explain salted hashing, lockout, access expiry, inactivity, refresh rotation and forced password changes. |
| [HTTP configuration](../../backend/src/bootstrap.ts) | Explain httpOnly/Secure/SameSite cookies, CSRF versus authentication, server validation and Swagger credentials. |
| [Provider permissions](../../backend/src/flights/flights.ts) | How are roles different from ownership/assignment? Why cannot moderator A edit provider B? |
| [Inventory](../../backend/src/bookings/inventory.ts) | Demonstrate last-seat contention, all-or-nothing round trips/multiple rooms and half-open stay dates. |
| [Bookings](../../backend/src/bookings/bookings.ts) | Explain snapshots, lifecycle, cancellation deadlines, refund tiers and completion. |
| [Payments](../../backend/src/payments/payments.ts) | Why not trust client success? Explain raw-body signatures, amount/currency checks, replay handling, compensation and repeated changes. |
| [Background jobs](../../backend/src/jobs.ts) | Why keep external calls outside transactions? Explain operation keys, leases, retry and crash recovery. |
| [Itineraries](../../backend/src/itineraries/itineraries.ts) | Explain derived dates, ordering/groups, budgets, FX fallback and independent clones without private booking IDs. |
| [Community](../../backend/src/community/community.ts) | Explain draft/privacy, one like/report/review rules, review eligibility and deactivated-author labels. |
| [Administration](../../backend/src/admin/admin.ts) | Explain separate account/provider status, reports, hiding/deletion and audit records. |
| [Media](../../backend/src/media/media.ts) | Why not trust the file extension? Explain decoding/size/count checks and private-parent access. |
| [Seeds](../../backend/src/seed.ts) | Explain official identifiers, idempotency, admin seeding and demo accounts versus contributors. |
| [Integration tests](../../backend/test/integration/platform.spec.ts) | What uses real MongoDB? What uses Stripe/SMTP fixtures? What requires account-backed evidence? |

## Perform your review

- [ ] Read `AI_PROMPTS.txt`, verify the disclosure and add any other AI conversations/tools you used.
- [ ] Read the source and answer the questions above in your own words; record unclear parts honestly.
- [ ] Run type checking, lint, tests and build; record actual results rather than treating earlier reports as your own execution.
- [ ] Follow the [Swagger walkthrough](../api/SWAGGER_WALKTHROUGH.md) for all application roles. These roles do not imply multiple student developers.
- [ ] Configure Atlas and record connection/seed evidence without exposing credentials.
- [ ] Exercise actual Stripe test-account confirmation, cancellation and refunds; keep raw card details out of the backend.
- [ ] Verify actual SMTP inbox delivery if submitting email bonuses.
- [ ] Read the [coverage audit](COVERAGE_AUDIT.md), including the booking-state interpretation; record an instructor answer if needed.
- [ ] Resolve important findings before submission. For future AI changes, record your review before merging.
- [ ] Push genuine solo development history to your GitHub repository; do not invent contributors, earlier reviews or old commits.

## Findings and outcome

| Area / requirement | Observation | Correction or question | Actual retest result |
| --- | --- | --- | --- |
| Pending your entry | No student finding recorded yet | Pending | Pending |

Review outcome: **Pending your entry**

Do not complete approval fields until you actually perform the review. No earlier student review is being retroactively asserted for the existing AI-assisted integration baseline.
