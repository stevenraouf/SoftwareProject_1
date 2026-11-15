# Follow-up coverage audit

The answer to “is everything required definitely covered?” is **not yet an unconditional yes**. Source coverage, passing representative tests, and complete submission acceptance are different claims. All workbook rows are registered; that alone does not certify every acceptance criterion.

## Confirmed gaps found and corrected

| Requirement area | Finding | Correction | Evidence |
| --- | --- | --- | --- |
| FLT-11, FLT-12 | Search/booking imposed an unrequested nine-seat group limit. Search combinations and hold rules could also disagree. | Removed the nine-seat business limit; actual cabin capacity determines availability. Input bounds now support the configured maximum cabin capacity and infant allowance. | A new ten-adult search/hold regression failed before the fix and passes afterward. |
| ACC-12, HTL-02 | Hotel details returned reviews without the author labeling applied by the dedicated reviews endpoint. A deactivated reviewer lacked the required label in that response. | Centralized public author formatting and applied it to both review response paths. | A deactivated-reviewer regression failed before the fix and passes afterward. |
| ACC-09, HTL-05, ITN-01/20 | Partial DTOs could contain omitted properties with undefined values. Assigning the whole DTO could erase unrelated fields, reject a phone-only update, remove room activity status, or lose itinerary visibility. | Assign only defined supplied values; reject null for nonnullable optional fields; preserve false and zero values. | A phone-only update failed before the fix. The regression now checks profile identity/currency, room active status, itinerary visibility, and invalid null input. |

The complete local suite after correction contains **46 passing tests**: six unit and 40 HTTP/replica-set integration scenarios. Type checking, lint, and build also passed. The new regressions supplement the earlier suite rather than redefining success around the old implementation.

A separate clean Git checkout then passed a fresh `npm ci` dependency install and the complete verification command (type checking, lint, all 46 tests, build). It reused the installed MongoDB executable as an external test prerequisite while creating a fresh disposable replica set. See `clean-checkout.json`. The updated compiled HTTPS smoke checks also passed.

Update on 14 November 2026: [API_TEST_REPORT.md](API_TEST_REPORT.md) records 56 passing tests and successful HTTP workflows for all 147 documented operations, plus 120 anonymous/100 role/86 CSRF checks. The earlier 46-test result above is historical. Separate live Atlas public-GET checks and VS Code Swagger/health inspection passed. Stripe/SMTP adapter fixtures and one successful workflow per operation do not certify every input or requirement.

## Outstanding acceptance evidence

- Atlas connection/indexes, repeatable official/admin seeds and HTTPS login/startup passed after the owner's local setup (see `evidence/atlas-setup.json`). Core account-backed flight/hotel payment, decline/retry, provider/traveler refunds and real timeout/cancellation passed on 15 November (see `STRIPE_VERIFICATION_REPORT.md`). Exhaustive concurrency and additional financial edge cases still use the disposable replica set.
- Account-backed Stripe fare changes, late-success compensation, refund failure and restart scenarios have not all been repeated externally; retain their representative fixture evidence and the explicit acceptance limits.
- Observe real SMTP test-inbox delivery for verification, password recovery, moderator invitations, and notifications.
- Review-branch publication and GitHub CI passed on 15 November for application commit `43814fe`; release merges await the student's review. See `evidence/github-ci.json`.
- Complete your own human Swagger walkthrough and source review as the sole student; record the actual version, date and findings. No second team member is presumed.
- Confirm the documented booking-state interpretation: provider cancellation invalidates pending holds as Expired, while GEN-11 explicitly associates expiration with hold timeout. The related requirements need a consistent interpretation; it is not silently counted as fully accepted.
- Next.js pages, visual design, navigation, responsive states and other frontend-only criteria remain Milestone 2 work.

## Limits of this audit

This is an engineering self-audit against the supplied specification and implementation. It is not independent human review, exhaustive formal verification, or a claim that every workbook row has an individual end-to-end test. The traceability register, review record, tests, and external-service evidence must be considered together before calling the milestone submission complete.
