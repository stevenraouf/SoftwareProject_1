# AI policy and solo submission record

## Contributor declaration

There is **one human student and developer: the repository owner**. The recorded Git identity is `stevenraouf`; a formal student name/ID has not been supplied. Codex is an AI development tool, not a second student or team member. Administrator, traveler, airline moderator and hotel moderator are application roles. Seeded demo accounts do not represent project contributors.

Substantial backend code, tests, debugging, architecture and documentation were AI-assisted. The sole student is responsible for the submitted result and must personally review and understand it. No student approval or completed human review is asserted here.

## Source and interpretation

Source: supplied project brief sections 10/10.5 on pages 11-12, sections 11-11.2 on page 13, and sections 12-14 on pages 13-14. The workbook controls individual functional requirements. These are course requirements being tracked, not authority to invent contributors, approvals or credentials.

Section 11.2 requires review before integration. It does not explicitly require a second student or an independent reviewer. For this solo project, record the owner's actual human review. Section 10.5 separately uses team-leader wording for PR review. Document the solo arrangement honestly; any course-specific accommodation comes from the instructor, not an invented teammate or waiver. The wording is not evidence that another person must be assigned by this project.

## AI policy status

| Policy item | In place | Student action still required |
| --- | --- | --- |
| Allowed AI uses | Explanation, planning, code/tests, debugging and documentation are disclosed | Include any AI use outside this conversation as well |
| 11.1: `AI_PROMPTS.txt` | Root log with dates, solo student identity, tool, requirements, prompts, use, corrections and evidence | Append future material prompts throughout development |
| Multi-turn record | Chronological entries distinguish verbatim prompts from summaries | Add omitted work from other conversations; it cannot be reconstructed without evidence |
| 11.2(a): responsibility | Assigned explicitly to the sole student, including AI-generated work | Review the actual submitted version and accept responsibility yourself |
| 11.2(b): understanding | Source-linked discussion/review guide provided | Work through the guide and demonstrate understanding; a document cannot establish it for you |
| 11.2(c): review before integration | AI review/test evidence exists; future workflow requires student review before merge | Student review was not recorded before the existing local integration. Review the baseline and record the real date; do not backdate approval or claim historical timing was satisfied |
| 11.2(d): sensitive credentials | Ignored local environment files, placeholders in examples, ignored TLS/runtime files | Configure real credentials privately; never paste them into prompts or the log |
| 11.2(e): ongoing log | Initial planning, decisions, implementation, audit and policy pass recorded | Keep the log current for later coding, debugging, testing and documentation |
| 11.2(f): substantial disclosure | README/log disclose substantial AI assistance; assistant-created commits identify Codex | Retain disclosure and describe its extent honestly during evaluation |

Passing tests and AI-authored commits do not constitute student review. Human-review fields remain pending until the student actually completes them. This record does not require another teammate.

## Optional bonuses: section 12

Mandatory completion has priority. Bonus code already exists in the baseline while mandatory external-account checks remain open. This record does not claim historical implementation order proved mandatory completion first. Accept/submit bonuses after the mandatory gate, and do not substitute them for missing required behavior.

| Bonus | Implementation/evidence | Remaining acceptance |
| --- | --- | --- |
| ACC-02: verification | Link/gate regression and actual SMTP link delivery passed 19 November | Student demonstration |
| ACC-07: password recovery | Actual SMTP reset links/form submission, supersession and single use passed; expiry regression passes | Student demonstration |
| GEN-01-B: mail notifications | Actual SMTP invitation and notification delivery passed to local test inbox | Student demonstration; personal/internet delivery not tested |
| FLT-27: flight changes | Actual higher-fare payment/lower-fare refund passed on 19 November | Student demonstration; additional permutations retain fixture evidence |
| FLT-28: seat selection | Maps/uniqueness regression | Student demonstration |
| HTL-26: review reply | Provider checks/regression | Student demonstration |
| ITN-27: booking links | Owner checks, costs counted once, clone regression | Demonstration with account-backed bookings |
| ITN-28: PDF export | Actual one-page export rendered and inspected; content and USD 28 total checked | Student demonstration; multilingual export layout not comprehensively checked |
| BLG-13: itinerary attachment | Attachment/privacy regression | Student demonstration |
| BON-01: analytics | Gross/refund/net regression; actual core sandbox payments/refunds now exist | Student demonstration and reconciliation of dashboard totals |
| BON-02: favourites | User-scoped saving regression | Student demonstration |

Cloud deployment is optional and outside this backend milestone. Next.js belongs to Milestone 2. Local demonstration still requires the specified Atlas database and external services.

## Milestone 1 deliverables: section 13.1

| Deliverable | Evidence | Acceptance state |
| --- | --- | --- |
| NestJS backend | `backend/src/`, package/lockfile, build scripts | Implemented; latest API run has 57 tests and 148 successful operation workflows; representative scope/limits in API report and coverage audit |
| Atlas integration | `MONGODB_URI`, schemas/indexes, seeds, setup guide; `evidence/atlas-setup.json`, `evidence/stripe-account-verification.json` | Live connection/indexes/seeds, HTTPS authentication and core account-backed Stripe/Atlas payment/refund/expiry run checked; student's walkthrough and additional edge cases pending |
| Swagger API | `/api/docs`, `/api/openapi.json`, `docs/api/` | Generated/exercised locally; student's walkthrough pending |
| README | Root setup guide | Present; clean-install/build/test evidence exists |
| Prompt log | Root `AI_PROMPTS.txt` | Updated for the visible conversation |
| Git/GitHub history | Genuine review-branch history published; Codex authorship retained; GitHub CI passed for application commit 43814fe | Sole-student review and release merges pending; no fictitious contribution split or approval |

## Important notes: section 14

- The original workbook remains authoritative. Preserved requirements/mappings are not automatic acceptance certificates.
- Supporting sessions, room-night allocations, webhook deduplication and retry work are justified in the reverse-engineering guide.
- Backend validation, role/session checks, ownership, business rules, transactions and uniqueness are implemented and exercised locally.
- The sole student must explain the actual design and code. Use the discussion guide and inspect the source rather than memorizing generated prose.
- Retain genuine history and AI disclosure. Do not rewrite assistant commits as historical student work or invent reviews.

## Current student review record

Student reviewer: **sole repository owner (you)**

Reviewed commit/version: **Pending student entry**

Actual review date and completed scenarios: **Pending student entry**

Outcome, unresolved questions and corrections: **Pending student entry**

Complete these after doing the review. They are honest pending fields, not a request for another team member. The assistant cannot complete them truthfully on the student's behalf.

## Checks performed for this documentation pass

The chronological prompt log and source-linked policy records are maintained for this conversation. The 19 November release audit verifies 57 tests, all 148 operations, current source/traceability links, actual core Stripe flows and all 11 bonuses with explicit limits. The original PDF/workbook remain unchanged. The student reported their personal review is not complete and credential rotation is uncertain; those items remain pending. These are AI-executed checks, not student approval.
