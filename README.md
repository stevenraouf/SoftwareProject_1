# Travel Planning and Booking Platform

## Milestone 2 · AERIS web application

The repository contains the Next.js frontend in `frontend/` and the NestJS API in `backend/`. The AERIS aircraft-window design covers desktop and mobile discovery, traveler bookings, itineraries, community content, and provider and administrator workspaces.

- [Combined project handbook (PDF)](output/pdf/AERIS_PROJECT_HANDBOOK.pdf) opens at the Milestone 2 chapter. Its PDF bookmarks include the 105 archived backend pages.
- [Frontend handover and verification](docs/milestone-2/HANDOVER.md) describes the application architecture, each role, setup, service dependencies and review evidence.
- [Original backend handbook](output/pdf/MILESTONE_1_HANDBOOK_2026-11-20.pdf) covers the November 20 release.

**Verified on 24 November 2026.** Backend lint/build, 62/62 Jest tests, all 151 REST operations, frontend type checking/production build and 14/14 Edge browser workflows passed. The configured D: API reached Atlas and Stripe sandbox checks succeeded. A new browser card payment awaits a matching publishable test key. See the handover for the exact environments, remaining human review and reproduction steps.

### Start the integrated site on Windows

On Steven's configured PC, run **START_AERIS.cmd** from the D: project root. A fresh checkout needs the local setup below first.

**Terminal A.** Begin in the root of the checkout you want to run. From that folder, copy `.env.example` to `backend/.env` if creating a new local configuration. Complete the private Atlas, administrator, signing and test-service settings described under **Configure the external services** below. Include `https://localhost:3000` in the backend's `CORS_ORIGINS`. Then run:

```powershell
Set-Location backend
npm.cmd ci
npm.cmd run certs
npm.cmd run seed
npm.cmd run start:local
```

Open the printed Swagger URL in your browser and trust the localhost certificate. **Terminal B.** From the same checkout root, install and start the frontend:

```powershell
Set-Location frontend
npm.cmd ci
if (!(Test-Path -LiteralPath .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev
```

Open [AERIS on localhost](https://localhost:3000). To enable browser checkout, set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in `frontend/.env.local` to the publishable test key from the backend's Stripe sandbox. Keep Stripe secret keys, webhook secrets, Atlas credentials and session secrets in private backend configuration. Restart the frontend after local environment changes. For a production build, run `npm.cmd run typecheck`, `npm.cmd run build`, then `npm.cmd start` from `frontend`.

After installing dependencies, generating local certificates and building both projects, run **START_AERIS.cmd** from the repository root to start the integrated site. On this PC the D: launcher serves the frontend at https://localhost:3000 and the API at https://localhost:3444; an ignored local configuration selects the existing backend environment. Fresh checkouts use port 3443 by default. The ignored root `.env.local` can set `AERIS_BACKEND_ENV`, `AERIS_API_PORT` and `AERIS_FRONTEND_PORT` to keep the two project versions side by side. For this D: checkout, run `node scripts/start-aeris.mjs --stripe` in a separate terminal to start the webhook listener for its selected API port. After initial signing-secret setup, restart the backend and keep the listener running for the sandbox exercise.

For isolated browser verification, build both applications, generate the certificates, install Microsoft Edge, then run `npm.cmd run test:browser` from `frontend`. The tests start a dedicated HTTPS frontend (3300), a dedicated API (3445), and a temporary MongoDB replica set. The first run requires access to download MongoDB 8.2.6 or a compatible cached binary.

To regenerate the combined PDF on Windows or Linux, install ReportLab, pypdf 6 or later, PyMuPDF and Pillow in a Python environment, then run `python scripts/export_project_handbook.py` from the repository root. The original backend PDF and the Markdown handover are its inputs. Rendered verification pages go under `tmp/milestone-2-handbook/`.

## Milestone 1 · backend release notes


NestJS 12 / TypeScript backend for Software Project I, Milestone 1. The repository includes mandatory backend functionality, the 11 workbook bonus feature implementations, Swagger/OpenAPI, official reference seeds, automated tests, and an implementation handover.

**Solo project:** the repository owner is the only human student/developer. Codex is an AI tool, not a team member. Substantial code, tests and documentation were AI-assisted; the disclosure is in [AI_PROMPTS.txt](AI_PROMPTS.txt). See the [policy and deliverable record](docs/milestone-1/AI_POLICY_AND_SOLO_SUBMISSION.md) and [your review/discussion guide](docs/milestone-1/SOLO_REVIEW_AND_DISCUSSION_GUIDE.md). Your own review and understanding remain your responsibility; no completed student review is claimed.

The [completed written review answers](docs/milestone-1/SOLO_REVIEW_COMPLETED_ANSWERS.md) provide all fifteen technical explanations, actual verification results and the recorded review summary. This clean companion preserves the original editable guide and accurately distinguishes AI-assisted writing, automated evidence and student-reported Swagger use. The source ZIP includes this companion separately from the existing PDF reading copy.

The supplied workbook remains the business-rule authority. The frontend and its visual requirements belong to Milestone 2. See [strategy and workflow](docs/milestone-1/STRATEGY_PLAN_WORKFLOW.md), [verification record](docs/milestone-1/REVIEW_AND_VERIFICATION.md), [requirements matrix](docs/requirements/TRACEABILITY.md), and [reverse engineering](docs/milestone-1/REVERSE_ENGINEERING.md).

The [follow-up coverage audit](docs/milestone-1/COVERAGE_AUDIT.md) records additional reproduced and fixed gaps. Passing local tests is not an unconditional claim of complete submission acceptance.

## Start on Windows

Use a currently patched Node.js 22 release and npm. Release checks passed with Node 22.23.5; `.nvmrc` pins that patched 22 release. The optional private `NODE_RUNTIME_PATH` lets the local launcher use a separately installed Node executable without changing Windows globally. Git, network access, and an Atlas account are required for the application. Tests use a disposable local MongoDB replica set rather than your Atlas database.

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

For subsequent sessions, double-click **`START_SWAGGER.cmd`** in the project folder and keep its terminal open. In VS Code, use **Terminal > Run Task > Start Travel API (Swagger)**. The equivalent command from `backend` is `npm.cmd run start:local`. This launcher builds the backend before starting it and reuses an already healthy local server, avoiding a second copy on the same port. Wait for the `Swagger:` startup line before refreshing the browser. Restarting Windows stops this local application; run the launcher again after signing in. These commands do not install an automatic Windows service or seed/overwrite database records.

If the browser shows `ERR_CONNECTION_REFUSED`, check the backend terminal: Swagger is available only while the server is running and has connected to Atlas. Start one copy from `backend` with `npm.cmd run start` (or `npm.cmd run start:dev` while editing). A `queryTxt ETIMEOUT` startup error means the Atlas DNS TXT lookup timed out. Use Atlas **Connect > Drivers** to obtain its standard, non-SRV `mongodb://` connection string, retain its TLS/replica-set/authentication options and the `/travel_platform` database, and save it privately as `MONGODB_URI`. Restart the backend, then run `npm.cmd run check:atlas` and `npm.cmd run check:live`. The connection checker accepts both Atlas URI formats and requires explicit TLS for the standard format. See [MongoDB's DNS and connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/). If Atlas changes the cluster's hosts, obtain a fresh standard connection string.

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

For a local demonstration, start **`START_STRIPE_TEST.cmd`** first and wait for its ready message, then start **`START_SWAGGER.cmd`**. Keep both processes running. The matching VS Code tasks are **Start Stripe test webhooks** and **Start Travel API (Swagger)**. The launchers respect the optional private `NODE_RUNTIME_PATH`. Start only one Stripe listener; if its signing secret changes after the backend starts, restart the backend.

The account-backed [Stripe verification guide](docs/milestone-1/STRIPE_INTEGRATION_VERIFICATION.md) provides the private-key setup and listener/verification commands. The full real sandbox run was repeated successfully on 19 November: decline/retry, signed-webhook flight/hotel confirmation, traveler/provider refunds and the actual ten-minute hold expiry. See the [readable Stripe report](docs/milestone-1/STRIPE_VERIFICATION_REPORT.md). From `backend`, `npm.cmd run check:stripe` checks sandbox authentication; `npm.cmd run stripe:listen` stores the webhook signing secret privately; after backend restart, `npm.cmd run verify:stripe` exercises those actual account-backed cases. `node scripts/verify-stripe.mjs --plan` previews the steps without external changes. Stripe and the backend must use the same sandbox; retain the listener for local webhook delivery.

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

All 11 bonuses passed additional live verification on 19 November; see [BONUS_VERIFICATION.md](docs/milestone-1/BONUS_VERIFICATION.md). The local development setup now uses actual SMTP delivery into Mailpit at **http://127.0.0.1:8025**, with no internet relay. With `SMTP_TEST_INBOX=mailpit`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025` and a verified `MAILPIT_PATH` configured privately, the startup launcher starts a missing test inbox automatically. New travelers must follow their email verification link before booking. Password recovery emails open a single-use HTTPS form; do not cache/share those links. `npm.cmd run verify:bonuses` creates identifiable synthetic verification records and actual Stripe sandbox transactions; it requires the backend, Stripe listener and local inbox to be running.

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

Jest's ESM support emits an experimental VM-modules notice on Node 22. Tests exercise the application with a real replica set. Live Atlas connection, index/seed and HTTPS authentication/startup evidence is recorded in [atlas-setup.json](docs/milestone-1/evidence/atlas-setup.json). A separate real Stripe sandbox/Atlas payment-refund-expiry run passed; see [stripe-account-verification.json](docs/milestone-1/evidence/stripe-account-verification.json). Actual higher/lower-fare Stripe changes and all 11 bonuses passed the 19 November [bonus verification](docs/milestone-1/BONUS_VERIFICATION.md), including SMTP delivery to a local development inbox. Additional late-success/refund-failure/restart permutations retain their representative fixture evidence. The real FXRatesAPI response was checked through the backend. Read the verification record before treating the backend as ready for submission.

For an operation-by-operation report, run `npm.cmd run test:api` from `backend`. It runs the suite, records completed HTTP responses for every OpenAPI operation, and regenerates [API_TEST_REPORT.md](docs/milestone-1/API_TEST_REPORT.md). The release audit on 19 November passed 57 tests and successful workflows for all 148 operations, plus anonymous/role/CSRF matrices. A separate fresh install and the same checks passed on Node 22.23.5. See [submission readiness](docs/milestone-1/SUBMISSION_READINESS.md). The gate fails when a documented operation lacks a successful workflow. This is operation coverage, not exhaustive proof of every business rule. On this machine, the already installed test binary can be reused:

```powershell
$env:MONGOMS_SYSTEM_BINARY = (Resolve-Path 'node_modules/.cache/mongodb-memory-server/mongod-x64-win32-8.2.6.exe').Path
npm.cmd run test:api
```

With the application running, `npm.cmd run check:live` checks 11 public GET requests over certificate-verified HTTPS against the local Atlas-backed application. It does not mutate application records or use administrator credentials. Full automated operation workflows use a disposable database; Stripe/SMTP adapters use fixtures.

## Repository workflow

Use `feature/<requirement-id>-<description>` branches from `develop`. For future AI-assisted changes, update the prompt log, run relevant checks, and record your own human review before merging into `develop`; release to `main` after acceptance checks. `origin` points to the student's supplied `https://github.com/stevenraouf/SoftwareProject_1.git`. The current review branch `feature/PAY-01-stripe-verification` was published with its genuine history on 15 November; latest GitHub CI passed on 19 November for audited application commit `1ac0130` (see [github-ci.json](docs/milestone-1/evidence/github-ci.json)). It is the remote's initial default branch. Release merges await the sole student's actual review. No earlier student approvals or additional contributors are fabricated. The source brief uses team-leader wording; the policy record preserves that fact without inventing a teammate or an instructor waiver.

The earlier backend baseline is on `develop`; the 19 November audit changes remain on the review branch. `main` retains the initial specification baseline. On 20 November the owner approved inclusion of the supplied written explanations and documentation/package finalization and reported personally checking Swagger. The [approval and test record](docs/milestone-1/STUDENT_APPROVAL_AND_TEST_RECORD.md) distinguishes that approval from detailed personal test execution and historical engineering results. The package manifest identifies the exact source snapshot. Commits created during this session identify Codex as their author; they do not pretend to be historical student contributions.
