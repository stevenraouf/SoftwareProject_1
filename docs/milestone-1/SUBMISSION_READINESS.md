# Milestone 1 submission readiness

Engineering checks completed on **19 November 2026**; owner approval and handover updated on **20 November 2026**, Africa/Cairo.

## Verdict

**Engineering verification passed. Owner approval for the supplied explanations and documentation/package finalization is recorded on 20 November.** The sole student reports personally checking Swagger. Specific personal execution dates, versions, roles and outcomes were not supplied; the recorded engineering results remain attributed to their actual assistant/automated executions. Password rotation after earlier disclosure remains unconfirmed. See the [approval and test record](STUDENT_APPROVAL_AND_TEST_RECORD.md).

The backend, API documentation, requirements register, setup instructions, prompt log and reverse-engineering handover are present. All 104 mandatory workbook rows and 11 bonus rows are mapped. GEN-14 through GEN-17 are frontend-only Milestone 2 items; other UI portions are identified separately from their implemented backend support.

## Fresh submission check on 20 November

A fresh extraction of the exact verified ZIP at `b5be49d` passed a new dependency installation, type checking, lint, all **57 tests**, **148/148** successful API workflows, build and five compiled HTTPS/actual-FX checks on Node 22.23.5. No application secrets were copied into the clean test installation. The 120 anonymous, 100 wrong-role and 86 missing-CSRF checks passed again.

Current Atlas authentication/aborted transaction, actual Stripe sandbox authentication, local SMTP connectivity and eleven certificate-verified public HTTPS/Swagger checks passed. An initial combined Atlas probe failed; a direct check and a complete combined rerun passed. The initial attempt is retained, and no application defect or specific root cause is inferred. The full real payment/refund/ten-minute-expiry and all-bonus runs remain dated 19 November; they were not relabeled as new runs or personal student execution.

Two additional AI audits found no concrete source/package blocker. They verified requirements/implementation paths, core authorization/inventory/payment rules, archive-to-Git consistency, original source hashes, private-file/secret exclusions, the handbook and successful CI for the explicit packaged commit. These are AI checks, not independent human review. See [the fresh verification record](evidence/pre-submission-check-2026-11-20.json).

**Submission version:** use the verified source ZIP or the current `feature/PAY-01-stripe-verification` version identified in its manifest. The repository default branch contains the implementation; `develop` is older and `main` still contains the initial specification baseline. Draft PR 1 remains unmerged. Do not give `main` as the completed backend. Password rotation remains unconfirmed after the student's latest response; follow the private steps below before final use/submission.

## Verification performed

| Check | Result and scope |
| --- | --- |
| Automated unit/integration tests | **57 passed, 0 failed, 0 skipped**, using a disposable real MongoDB 8.2.6 replica set |
| API operation coverage | **148/148** operations have successful HTTP workflows, including the added emailed password-reset form |
| Permissions | **120** anonymous-access, **100** wrong-role and **86** missing-CSRF checks passed; ownership/provider-boundary scenarios also passed |
| TypeScript, lint and build | Passed in the working tree and a fresh source installation |
| Clean installation | Fresh `npm ci`, type checking, lint, tests and build passed in a separate directory with no application secrets copied |
| Patched runtime | Clean checks also passed on **Node 22.23.5**; the local launcher uses the verified portable runtime configured privately |
| Compiled HTTPS smoke | Five checks passed, including secure cookies, CSRF and a real FXRatesAPI fetch/cache; TLS certificates are explicitly verified |
| Atlas-backed application | Authentication/read-only transaction and **11 public HTTPS checks** passed |
| Real Stripe core workflows | New 19 November run passed decline/retry, real signed-event flight/hotel confirmation, traveler/provider refunds and the actual ten-minute hold expiry/cancellation |
| All 11 bonuses | Additional Atlas/Stripe/SMTP verification passed; see the bonus report for exact scope |
| Dependency audit | Both production-only and full installed-dependency audit reported **0 vulnerabilities** on this run |
| GitHub publication and CI | Application commit `1ac0130c483cc4b6dbdd1f5f95d35d6806d4becc` was pushed; [GitHub Actions run 44598887393](https://github.com/stevenraouf/SoftwareProject_1/actions/runs/44598887393) passed fresh install, compiler/lint/tests/build and production audit |
| Requirement sources | All 115 requirement texts match the supplied workbook; cached reference records match the official remote workbook |
| Source/privacy checks | No missing mapped source paths, broken local Markdown links or configured secret-value matches in the submission source; private environment, certificates and runtime directories remain ignored |

The workflow tests use fixture Stripe/SMTP adapters for repeatable edge cases. Separate live verifiers use actual Atlas, real Stripe sandbox objects and actual SMTP delivery to a local Mailpit development inbox. No real card details or personal inbox credentials are sent to this backend. One successful workflow per operation is not exhaustive proof of every possible input or race.

## Findings corrected during this audit

1. **GEN-11 / FLT-06:** provider cancellation previously changed an unpaid booking to Expired before its hold deadline. The backend now releases the unusable inventory once, records `holdInvalidatedAt` and a reason, blocks further policy acceptance/payment, and keeps the booking Pending Payment until the original deadline. Only timeout changes it to Expired. Late successful payments are refunded without recreating inventory. The new regression covers release, retries, compensation and eventual expiry.
2. **ACC-07:** the recovery email previously supplied only a token. It now supplies a usable, single-use HTTPS reset link and a minimal password form. The form is not cached, suppresses referrers, and submits the password in the request body. Superseded/consumed links are rejected. A live URL-encoded form submission and SMTP link delivery passed.
3. **Verification tooling:** the real Stripe verifier now supports the configured standard MongoDB connection string as well as the SRV format. Test reports use the actual client date, and the live check compares deployed routes with the generated OpenAPI list.
4. **Local operation:** the Windows/VS Code launcher builds before starting, reuses an existing healthy backend and can start the loopback-only SMTP test inbox. It can use the privately configured patched Node runtime. A reboot still stops local services; no Windows service is installed.
5. **Local webhook forwarding:** a backend restart interrupted one bonus test's delivery. Official Stripe event redelivery recovered the real event; no local signature or synthetic success event was fabricated. The successful bonus rerun and the delivery limitation are recorded.

## Actions required from the sole student

- [x] Approve inclusion of the supplied written explanations and documentation/package finalization: explicit user approval received 20 November 2026.
- [x] Report personal Swagger use: the student confirmed this in the conversation; individual outcomes were not supplied.
- [ ] Review the actual source and the material AI contributions. Work through [the solo review guide](SOLO_REVIEW_AND_DISCUSSION_GUIDE.md) and answer its questions in your own words.
- [ ] Perform the [Swagger walkthrough](../api/SWAGGER_WALKTHROUGH.md) for guest, traveler, administrator, airline moderator and hotel moderator. Record actual results and any failures.
- [ ] Add the exact version/date and findings from personal execution if available. Approval is recorded today against baseline `2bc6170344ab030be7e3899d5e0bfdab7ea55e62`; it does not establish historical pre-integration review timing. Retain honest disclosure and clarify course-specific solo wording with the instructor if needed.
- [ ] Privately rotate the Atlas database password and application administrator password if you cannot confirm they were replaced after being shared. Never put replacements in chat, screenshots, Git or this checklist.
- [ ] Check the course submission portal's required format, repository link and deadline. No submission portal action has been performed by the assistant.
- [ ] Merge/release only after your actual review, then ensure the submitted branch/version is the one you reviewed. Genuine Codex authorship is preserved.

## Private password-rotation steps

For Atlas, open the project, go to **Database & Network Access > Database Users**, edit `travel_app`, set a fresh password privately and save it. Update only the encoded password portion of `MONGODB_URI` in `backend/.env`; preserve the database, hosts, TLS, replica-set and other options. Run `npm.cmd run check:atlas` from `backend` afterward. Changing the Atlas website login password does not change this database user's password.

For the application administrator, log in through Swagger using the application's current credentials. Use `PATCH /api/auth/change-password` with `currentPassword` and `newPassword` entered privately. Successful change revokes sessions, so log in again. Update your private `ADMIN_PASSWORD` setup value to the new value. `ADMIN_PASSWORD` is a seeding setting: editing the environment file alone does not change an existing account's stored password.

Restart the backend after changing its environment configuration. Ask for a fresh connectivity check without sharing any credential values. Keep the old credential-sharing incident disclosed honestly; rotation protects future access but does not change the historical record.

## Demonstration startup

1. Double-click `START_STRIPE_TEST.cmd`, or run **Terminal > Run Task > Start Stripe test webhooks**. The equivalent command is `npm.cmd run stripe:listen` from `backend`. Keep it running and wait for its ready message. It saves the local webhook signing secret privately.
2. Run `START_SWAGGER.cmd`, or **Terminal > Run Task > Start Travel API (Swagger)** in VS Code. Keep the backend running. Wait for `Swagger:` before opening the page.
3. Open **https://localhost:3443/api/docs**. The local development certificate is self-signed; use the same hostname throughout.
4. For the configured local email profile, open **http://127.0.0.1:8025**. Messages remain inside the local test inbox; they are not delivered to personal/internet mailboxes.
5. If the listener's secret changes after the backend started, restart the backend before testing payment confirmation.

The current private local setup enables email bonuses. Newly registered travelers must follow their verification link from the test inbox before booking. Synthetic verification accounts are application actors, not project contributors. Their generated credentials stay under ignored `backend/.local`; use your own private administrator settings for your review.

## Evidence

- [Current operation report](API_TEST_REPORT.md)
- [Bonus verification](BONUS_VERIFICATION.md)
- [Real Stripe verification](STRIPE_VERIFICATION_REPORT.md)
- [Review and verification history](REVIEW_AND_VERIFICATION.md)
- [Source audit](evidence/source-audit-2026-11-19.json)
- [Live bonus receipts](evidence/bonus-verification-2026-11-19.json)

Human owner: **sole repository owner, Git identity `stevenraouf`**; formal student name/ID not supplied.

Owner approval: **20 November 2026**, for inclusion of the supplied explanations and documentation/package finalization. Personal Swagger use is reported; exact personal test outcomes remain unrecorded. [Approval and result attribution](STUDENT_APPROVAL_AND_TEST_RECORD.md) preserves this distinction.

The review branch is `feature/PAY-01-stripe-verification`. Existing genuine `develop` and `main` histories were published without merging the audit changes. [Draft pull request 1](https://github.com/stevenraouf/SoftwareProject_1/pull/1) provides a concrete integration target. The final package manifest identifies the exact packaged documentation revision. Documentation approval does not invent an independent source review, detailed personal executions, release merge or portal submission; the explicit tested application commit above remains unchanged.
