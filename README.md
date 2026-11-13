# Travel Planning and Booking Platform

NestJS 12 / TypeScript backend for Software Project I, Milestone 1. The repository includes mandatory backend functionality, the 11 workbook bonus feature implementations, Swagger/OpenAPI, official reference seeds, automated tests, and an implementation handover.

**Solo project:** the repository owner is the only human student/developer. Codex is an AI tool, not a team member. Substantial code, tests and documentation were AI-assisted; the disclosure is in [AI_PROMPTS.txt](AI_PROMPTS.txt). See the [policy and deliverable record](docs/milestone-1/AI_POLICY_AND_SOLO_SUBMISSION.md) and [your review/discussion guide](docs/milestone-1/SOLO_REVIEW_AND_DISCUSSION_GUIDE.md). Your own review and understanding remain your responsibility; no completed student review is claimed.

The supplied workbook remains the business-rule authority. The frontend and its visual requirements belong to Milestone 2. See [strategy and workflow](docs/milestone-1/STRATEGY_PLAN_WORKFLOW.md), [verification record](docs/milestone-1/REVIEW_AND_VERIFICATION.md), [requirements matrix](docs/requirements/TRACEABILITY.md), and [reverse engineering](docs/milestone-1/REVERSE_ENGINEERING.md).

The [follow-up coverage audit](docs/milestone-1/COVERAGE_AUDIT.md) records additional reproduced and fixed gaps. Passing local tests is not an unconditional claim of complete submission acceptance.

## Start on Windows

Use a currently patched Node.js 22 release and npm. This implementation was checked with Node 22.14.0; `.nvmrc` selects the 22 line. Git, network access, and an Atlas account are required for the application. Tests use a disposable local MongoDB replica set rather than your Atlas database.

```powershell
Set-Location C:\Users\User\Desktop\Steven_Software_project
Copy-Item .env.example backend/.env
Set-Location backend
npm.cmd ci
npm.cmd run certs
```

Edit `backend/.env` locally. Configure `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET` before seeding. Generate a secret with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste the value into your local environment file. Do not send credentials in chat or commit them. TLS keys and runtime media are also ignored by Git.

```powershell
npm.cmd run seed
# Optional demonstration inventory and accounts:
npm.cmd run seed:demo
npm.cmd run start:dev
```

Open **https://localhost:3443/api/docs**. The certificate is self-signed for local use; accept it for localhost in your browser. Keep using the same hostname for login, Swagger, and API calls. The server binds to loopback by default.

`seed:demo` creates `traveler@example.test`, `airline@example.test`, and `hotel@example.test`. Their initial password is the locally configured `ADMIN_PASSWORD`; moderator accounts must change it. These are fictional development accounts. Demo seeding is forbidden when `NODE_ENV=production`. Reference and account seeds do not overwrite existing passwords or inventory.

Use `npm.cmd` in PowerShell: the `npm.ps1` wrapper on this machine handled forwarded CLI options differently. To pass Jest reporting options reliably, invoke its Node entry point directly as shown below.

## Configure the external services

### MongoDB Atlas

1. Create an Atlas project and a database deployment that supports transactions.
2. Create a database user with access to the application database; use credentials different from your Atlas login.
3. Add your current development IP address to the project's network access list.
4. Copy the Node.js driver connection string into `MONGODB_URI`. Include a database name, such as `travel_platform`. URL-encode special characters in the password.
5. From `backend`, run `npm.cmd run check:atlas`. It checks authentication and an aborted read-only transaction without printing credentials or changing data. It does not establish write permissions or replace the seed/start verification.
6. Set your local `ADMIN_EMAIL` and `ADMIN_PASSWORD`, run `npm.cmd run seed`, then start the backend and inspect `/api/health`. Never use an application database for destructive test runs.

The project uses one shared application database even though development is solo. Local integration tests start a separate replica set and never reuse `MONGODB_URI` from your environment file. Official reference JSON preserves all four datasets and identifiers, including attractions. See [Atlas connection documentation](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

Keep `PLATFORM_CURRENCY=USD` unless you deliberately configure another supported two-decimal settlement currency before creating inventory. JPY is available for itinerary display, but not platform settlement. Do not change settlement currency after creating priced inventory.

### Stripe test mode

1. Create or open your Stripe test environment. Add the **test** secret key to `STRIPE_SECRET_KEY`; live keys are rejected at startup.
2. Install Stripe CLI and authenticate it in your own terminal.
3. Forward events to your local HTTPS backend:

```powershell
stripe listen --forward-to https://localhost:3443/api/payments/webhook --skip-verify
```

4. Put the listener's webhook signing secret in `STRIPE_WEBHOOK_SECRET`, then restart the backend. The signing secret is distinct from the Stripe API secret.
5. Create a hold, accept policies, and create a payment using Swagger. The response contains the PaymentIntent ID and client secret. Card data must go directly to Stripe, never into this API.
6. For a backend-only test, use Stripe CLI with the returned PaymentIntent ID and a Stripe test payment method:

```powershell
stripe payment_intents confirm pi_REPLACE --payment-method pm_card_visa
```

Subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `refund.created`, `refund.updated`, and `refund.failed`. Signed webhooks confirm bookings; a success message from a client cannot confirm one. Refunds and cancellations are retried through persisted jobs. See [Stripe local webhook testing](https://docs.stripe.com/webhooks#local-listener).

### FXRatesAPI

Set `FX_API_KEY` locally if your API plan requires a key. The default URL is the specified FXRatesAPI service. As administrator, invoke `POST /api/admin/exchange-rates/refresh` after setup. The scheduled worker refreshes daily, checking hourly. The latest successful response stays in MongoDB if the provider is unavailable. Multi-currency totals return an explicit unavailable result before any usable rate cache exists; the application never invents rates. Booking payments always use the single platform currency.

### SMTP and email bonuses

Configure a test inbox provider's SMTP host, port, username, password, and sender. Use port 465 with `SMTP_SECURE=true` for implicit TLS, or the provider's STARTTLS port with `SMTP_SECURE=false`. Set `ENABLE_EMAIL_BONUS=true` only once SMTP is working. Newly registered travelers then need email verification before booking. Moderator invitations omit passwords; administrators must communicate temporary passwords securely. Reset tokens expire after 30 minutes, are single-use, and are superseded by a newer request. Emails use persisted retry jobs; inspect your test inbox to verify delivery.

## API workflow

1. **Administrator:** log in; create providers; create their moderator accounts.
2. **Moderator:** log in; change the temporary password and log in again; configure policies, inventory, and availability.
3. **Traveler:** register and log in; search; preview a flight booking or choose hotel rooms; create the 10-minute hold.
4. Read and accept the booking's policy snapshot, then create a payment.
5. Pay directly through Stripe. Inspect the webhook-confirmed booking, notification, and e-ticket.
6. Read the cancellation quote before confirming cancellation; inspect the refund status.

Swagger sends cookies automatically. It reads only the separate CSRF cookie to add `X-CSRF-Token` to write requests. Authentication tokens remain httpOnly. After the 15-minute access token expires, call `/api/auth/refresh`; 30 minutes without an authenticated request expires the server session. Logout and password changes revoke sessions. Swagger uses no localStorage/sessionStorage for authentication.

For flight booking, `POST /api/flight-bookings` is a validated summary; `POST /api/flight-bookings/hold` performs the actual reservation. `POST /api/hotel-bookings` holds all requested rooms together. `POST /api/flight-changes/:id/payment` pays a positive fare difference; the original booking remains valid until a successful change commits.

For a paid flight change, first read `/api/flight-changes/:id/policies` and record confirmation through `/api/flight-changes/:id/accept-policies`. Replacement policies have their own acceptance timestamp.

Backend contracts, field schemas, role permissions, errors, and requirement IDs are documented in [OpenAPI](docs/api/openapi.json) and the running Swagger UI. Additional demonstrations are in [the walkthrough](docs/api/SWAGGER_WALKTHROUGH.md).

## Checks

```powershell
Set-Location backend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd audit --omit=dev
```

MongoDB integration tests require sufficient free disk space and may download the pinned MongoDB 8.2.6 test binary on the first run. On this machine C: was too full for index builds. Redirect only the disposable database to a drive with space:

```powershell
$env:TEST_TMP_DIR = 'D:/Steven_Software_project_test_cache'
npm.cmd test
```

The test creates a uniquely named child directory under that root and removes only that child after stopping MongoDB. Tests do not weaken MongoDB's disk safeguards. To save machine-readable results:

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --json --outputFile=../docs/milestone-1/test-results.json
```

Jest's ESM support emits an experimental VM-modules notice on Node 22. Tests exercise the application with a real replica set. Live Atlas connection, index/seed and HTTPS authentication/startup evidence is recorded in [atlas-setup.json](docs/milestone-1/evidence/atlas-setup.json). Full Atlas booking/payment workflows, account-backed Stripe confirmation/refunds, and actual SMTP delivery remain pending; the real FXRatesAPI response was already checked through the backend. Read the verification record before treating the backend as ready for submission.

## Repository workflow

Use `feature/<requirement-id>-<description>` branches from `develop`. For future AI-assisted changes, update the prompt log, run relevant checks, and record your own human review before merging into `develop`; release to `main` after acceptance checks. The local repository has no GitHub remote. Create/connect your own repository and push genuine solo history. No earlier student approvals or additional contributors are fabricated. The source brief uses team-leader wording; the policy record preserves that fact without inventing a teammate or an instructor waiver.

The implemented application is integrated on `develop`. `main` retains the initial specification baseline until the outstanding account-backed release checks pass. Commits created during this session identify Codex as their author; they do not pretend to be historical student contributions.
