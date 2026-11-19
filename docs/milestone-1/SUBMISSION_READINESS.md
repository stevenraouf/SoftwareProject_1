# Milestone 1 submission readiness

Checked on **19 November 2026**, for the planned **20 November 2026** submission.

## Verdict

**Engineering verification passed. Student sign-off remains pending.** The sole student reported that their personal source review and Swagger walkthrough are not complete. Password rotation after earlier disclosure is also unconfirmed. These cannot truthfully be marked complete by an AI assistant.

The backend, API documentation, requirements register, setup instructions, prompt log and reverse-engineering handover are present. All 104 mandatory workbook rows and 11 bonus rows are mapped. GEN-14 through GEN-17 are frontend-only Milestone 2 items; other UI portions are identified separately from their implemented backend support.

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

- [ ] Review the actual source and the material AI contributions. Work through [the solo review guide](SOLO_REVIEW_AND_DISCUSSION_GUIDE.md) and answer its questions in your own words.
- [ ] Perform the [Swagger walkthrough](../api/SWAGGER_WALKTHROUGH.md) for guest, traveler, administrator, airline moderator and hotel moderator. Record actual results and any failures.
- [ ] Enter your real reviewed commit/version, review date and findings in the policy record and solo guide. Do not backdate approval. Earlier review-before-integration timing cannot be established retrospectively; retain the honest disclosure and clarify course-specific solo review wording with the instructor if needed.
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

Human reviewer: **sole student; pending actual entry**.

Review date, reviewed version, findings and final acceptance: **pending student entry**.

The review branch is `feature/PAY-01-stripe-verification`. Existing genuine `develop` and `main` histories were published without merging the audit changes. [Draft pull request 1](https://github.com/stevenraouf/SoftwareProject_1/pull/1) provides a concrete review target into `develop`; no reviewer, approval or release was invented. Review the final submitted version, including any later documentation-only handover commit, and retain the explicit tested application commit above.
