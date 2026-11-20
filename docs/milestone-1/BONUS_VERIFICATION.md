# Bonus verification on 19 November 2026

**All 11 workbook bonuses passed the additional live verification.** Requests used the real Atlas application database, actual Stripe sandbox PaymentIntents/refunds and real SMTP delivery into a loopback-only Mailpit development inbox. These checks are separate from the fixture adapters in the automated HTTP suite.

| Requirement | Executed evidence |
| --- | --- |
| ACC-02 | Registered a synthetic traveler, observed the actual SMTP verification link, rejected booking before verification, consumed the link and rejected its reuse |
| ACC-07 | Observed reset emails, opened the reset form, rejected a superseded token, submitted a new password as URL-encoded form data, rejected reuse and logged in with the changed password; the 30-minute boundary is separately tested with controlled timestamps |
| GEN-01-B | Observed actual SMTP moderator invitations and booking confirmation, cancellation, refund, schedule-change, provider-status and account-suspension notification emails |
| FLT-27 | Confirmed a USD 10 flight through a real signed event; held a USD 15 replacement while preserving the original; paid the USD 5 difference; changed to USD 8 and observed a real USD 7 refund; booking reference stayed unchanged |
| FLT-28 | Two actual Atlas-backed, paid bookings concurrently requested the same seat; exactly one request succeeded and one was rejected, leaving one seat record |
| HTL-26 | Submitted a review against a clearly synthetic completed-stay fixture; the assigned hotel moderator replied through HTTP and the reply persisted |
| ITN-27 | Linked real confirmed flight and hotel bookings once; duplicate linking was rejected; the total including food/activity/transport was USD 28; an independent clone copied costs without private booking links |
| ITN-28 | Downloaded the actual one-page itinerary PDF, extracted the expected dates/day content/USD 28 total and visually inspected the rendered page |
| BLG-13 | Published a post, attached its public itinerary through HTTP and retrieved the public post |
| BON-01 | Provider analytics reconciled to actual sandbox records: USD 23 gross payments, USD 13 refunds and USD 10 net revenue, shown separately |
| BON-02 | Saved and listed a hotel and public itinerary, then removed the hotel favourite and verified the remaining list |

## Scope and limits

The local SMTP inbox is an actual SMTP server and web inbox, with no external relay configured. This satisfies the workbook's development test-inbox scenario. Delivery to personal or internet mailboxes was not tested. Mailpit is not a substitute for configuring a production email provider.

Review eligibility uses a synthetic historical completed-stay fixture. No real hotel stay or forged real customer's booking is claimed. All other fixture records are explicitly labeled verification data. No raw card number passes through this backend; Stripe receives its documented test payment-method identifiers directly.

An earlier attempt exposed the token-only recovery email, which was corrected to a real link/form. A later attempt encountered an interrupted local webhook delivery during a backend restart. Stripe's official event-redelivery command delivered the original real event successfully. The successful rerun uses actual signed events; no locally fabricated success payload or signature was used. Verification tooling also now requests official redelivery if a local test delivery is delayed.

The automated suite covers additional representative failure, expiry, ownership and concurrency scenarios. This live pass is not exhaustive proof of every bonus edge case. It is AI-executed evidence, not the student's own review.

## Reproduce

Use the README to install dependencies, configure Atlas, local HTTPS and Stripe test credentials privately. Install Mailpit from its [official releases](https://github.com/axllent/mailpit/releases/tag/v1.34.0) and check its published checksum. The Windows AMD64 archive used for this run has SHA-256 `8f080d41374bf22686606374a0a483c8563c1bf29ae078179792392ff8c911d7`.

Configure this development profile privately in `backend/.env`:

```dotenv
ENABLE_EMAIL_BONUS=true
SMTP_TEST_INBOX=mailpit
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
MAILPIT_PATH=C:/Tools/Mailpit/mailpit.exe
MAILPIT_HTTP_PORT=8025
```

`MAILPIT_PATH` is an example installation location; use the actual local path. The startup launcher starts a missing local test inbox, binds its SMTP/UI ports to loopback and builds/starts the backend. SMTP delivery is local only. No personal email credentials are required for this profile.

Start the Stripe listener first, then the backend, and keep both running. From `backend`, run `npm.cmd run verify:bonuses`. The verifier starts a temporary second HTTPS application on port 3445 against the same Atlas database and mailbox, performs the bonus cases and shuts that temporary application down. The existing port-3443 application receives actual signed Stripe events. Reserve ports 3443, 3445, 1025 and 8025 for these services during the run.

The verifier creates identifiable synthetic accounts, providers, content and sandbox payments. It is intended for a development application database and Stripe test mode only. The private run manifest stays in ignored `backend/.local`; the public [receipts](evidence/bonus-verification-2026-11-19.json) contain result/status and sandbox IDs, with no passwords, cookies, API keys, reset tokens or client secrets.
