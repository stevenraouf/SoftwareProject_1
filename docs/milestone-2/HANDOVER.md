# AERIS · Milestone 2
Frontend and final integration

## The window seat

The homepage opens on an aircraft window. Choose a country to preview its landscape, or use the flight form directly. Exploring a destination opens a greeting in its language and offers an airport from the reference data. Choosing the airport starts a search. Browsing photographs alone never reserves inventory or quotes a fare.

AERIS uses the approved cabin theme. The responsive shell carries the window emblem, ivory surfaces, navy glass controls, Bricolage Grotesque headings, DM Sans branding and Source Sans 3 interface text. The cloud passage marks navigation. The motion preference and operating-system setting provide a stationary reading experience.

For the journal and planner landing pages, the application reuses the approved Paris editorial photographs and groups the title beside the image on wide screens. On phones, it stacks the title above the image. Search and editing controls use live API data, and the layouts adapt to empty results, validation errors and the signed-in role.

The frontend covers five human roles. Guests browse, travelers plan and reserve, administrators operate the platform, and each provider moderator manages their assignment. Automated services act through NestJS and its jobs. The browser displays their outcomes.

[Approved Figma design](https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=27-9726) · [Local artwork credits](../../frontend/public/art/CREDITS.md)

## Run the application

Use Node.js 22 and npm. Run the backend and frontend in separate terminals. Keep the same localhost hostname for Swagger, the web app, cookies and certificate trust.

1. From the repository root, copy `.env.example` to `backend/.env` if setting up a new installation. Set the Atlas connection, application administrator credentials, signing secret and Stripe test configuration privately. Use `CORS_ORIGINS=https://localhost:3443,https://localhost:3000` for the documented local setup.
2. In `backend`, run `npm.cmd ci`, `npm.cmd run certs`, then `npm.cmd run seed`. Use the documented demo seed only in a demonstration database. Start the API with `npm.cmd run start:local`. Verify `https://localhost:3443/api/health` in the same browser and accept or trust the local certificate.
3. In `frontend`, run `npm.cmd ci`. Copy `.env.example` to `.env.local` if this is a new checkout. Set `NEXT_PUBLIC_API_BASE_URL=https://localhost:3443/api`. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the publishable test key for the same sandbox used by the backend.
4. Run `npm.cmd run dev` in `frontend` and open `https://localhost:3000`. To use the production build, run `npm.cmd run build`, then `npm.cmd start`. The production server exposes the configured public API URL and sandbox publishable key through the page configuration. Restart the frontend after changing them.
5. For Stripe sandbox checkout in the D: checkout, use a separate terminal at the project root and run `node scripts/start-aeris.mjs --stripe`. It forwards to the API port selected by the launcher. Restart the backend after initial signing-secret setup and keep the listener running. Only the publishable test key belongs in frontend configuration.

On Steven's PC, open `D:\Steven_Software_project_M2` and run `START_AERIS.cmd`. This active checkout contains the Milestone 1 API and Milestone 2 website. Its ignored root `.env.local` sets `AERIS_BACKEND_ENV=backend/.env`, a path relative to the project root, and `AERIS_API_PORT=3444`. The website opens on port 3000. The launcher can reuse a healthy API and prints both URLs. Use the active checkout for launches and demos. The original checkout and Git history are preserved at `D:\Steven_Software_project_M1_Archive` for reference. A fresh checkout requires private settings and TLS files and defaults to API port 3443.

The homepage is generated at build time. The browser loads its public API address and Stripe publishable key from `/aeris-config.js` at startup so the same build works on the development and test ports. Public stories, author profiles and itineraries use the anonymous API on each request. The initial HTML contains readable content and item-specific metadata. Public Journal and Planner searches also render their results on the server. Pagination links preserve the filters and work with JavaScript disabled. Per-request reads let changes to publication or privacy take effect on the next visit. Client components handle editing, likes and booking actions after the session loads. Flight and hotel searches request current fares and availability from the API as travelers change search criteria. The local frontend trusts the API certificate in `../.certs/localhost.pem`. Set `AERIS_API_CA_PATH` if the loopback API uses another certificate.

## How a screen reaches the database

Next.js App Router serves the page. The shared shell restores the cookie-backed account with `/auth/me`. The requested route opens a feature screen. Its forms build typed requests that the NestJS controllers validate. Services check the role, owner, assignment, record state and capacity, then read or mutate MongoDB. The UI renders the returned record and validation errors.

| Source | Responsibility |
| --- | --- |
| `frontend/src/app` | Root layout, local fonts, route dispatch, global style and error pages |
| `frontend/src/components` | Window home and destination scenes, site navigation and session-aware account pages |
| `frontend/src/lib` | Credentialed API calls, CSRF, shared refresh, error parsing, safe return URLs and session provider |
| `frontend/src/features/booking` | Flight and stay searches, booking draft and holds, policy acceptance, Stripe Elements, reservations and ticket actions |
| `frontend/src/features/discovery` | Itineraries, expenses, destination references, linked searches and bookings, journal, author pages and protected media |
| `frontend/src/features/staff` | Administrator, airline and hotel workspaces bound to the signed-in account and provider |
| `frontend/public/art` | Licensed destination images, aircraft-window surround, cloud artwork and attribution |
| `backend/src` | Validation, permissions, inventory, prices, payment reconciliation, currency conversion, storage and scheduled jobs |

The browser includes secure cookies on API requests and echoes the separate CSRF token on writes. A 401 on a protected request can trigger one shared refresh and retry. The frontend keeps session state in memory. MongoDB credentials, the webhook signing secret, card details and private server keys belong outside the client bundle.

## Traveler walkthrough

1. In Flights, select two different official airports, future dates, a trip type, cabin and passenger counts. Search and inspect the available inventory. For a round trip, select both legs. Search results and prices depend on seeded provider inventory.
2. Sign in as a traveler to continue. Enter passenger details and baggage, review the quoted fare, then request a hold. For a stay, choose dates and occupancy, inspect the property and select available rooms for the specified guests.
3. Open the pending reservation, read the stored policies, record acceptance and open secure payment. Use the Stripe sandbox UI. The server receives the signed Stripe event before the booking becomes confirmed. A pending or failed payment has its own state.
4. From My trips, reopen the flight ticket or hotel reservation. On an eligible future confirmed flight, select a seat for each seated passenger and flight leg and return to check the assignment. Check cancellation terms, request the quote, confirm only if intended and inspect refund status. Completed stays can receive eligible traveler reviews.
5. Visit Account to update contact details and preferred currency. Open notifications, mark a notice read and revisit saved hotels or itineraries. Authentication, provider assignment and ownership are checked again by the backend.

The flight and hotel amount shown at checkout comes from the server booking snapshot in the platform payment currency. Preferred currency affects itinerary budgets. The payment and refund transitions, hold expiry and concurrency rules originate in Milestone 1.

## Planner and journal walkthrough

1. Open Trip planner and create a private itinerary with a title, start date and one or more official countries. Add days with cities and notes, then add activities and optional time or cost. Add a separate expense and an intercity transport entry.
2. Reorder days, remove a day after confirmation, and check the new dates, city groups and totals. Read the budget breakdown and the exchange-rate date when conversion applies. Use the city group to find available stays or search flights to the first city.
3. Link an eligible confirmed or completed booking to one day and export the owner's itinerary PDF. Make an itinerary public and open it in a signed-out browser. Travelers can save it or make an attributed private copy.
4. Open Journal, write a draft and publish it. Add up to five tags, attach supported images and optionally attach a public itinerary. Search by keyword, follow a tag, open the author page and check public stories and itineraries.
5. Sign in to add or remove a like, comment, edit or delete your own comment, or report content with a reason. Uploads use the backend's permission check, format validation, 5 MB limit and five-image limit for posts and activities.

The itinerary detail response supplies day dates, contiguous city groups and category totals. The journal post detail includes the viewer's own like state, so reloading the browser preserves the correct button. Owners can clear an activity time to make it unscheduled.

## Design and workbook map

The approved Figma file supplies the layout, artwork and motion. The frontend reads reference data, prices, availability, user roles and booking states from the backend. Editorial destinations illustrate travel regions. Selecting a window never guarantees a matching flight or room.

| Journey | Where to inspect it | Workbook anchors |
| --- | --- | --- |
| Window, localized greetings, mobile menu, motion preference and form feedback | `components/home.tsx`, `components/shell.tsx`, `app/style.css` | GEN-02 to GEN-06, GEN-14 to GEN-17 |
| Accounts, roles, recovery, saved items and inbox | `components/account.tsx`, `lib/session.tsx`, `lib/api.ts` | ACC-01, ACC-04 to ACC-12, ACC-19, GEN-01, BON-02 |
| Travel search, held inventory, policies, checkout, ticket, seats and refunds | `features/booking`; flight, hotel, inventory and payment services | FLT-11, FLT-12, FLT-17, FLT-19 to FLT-28; HTL-11 to HTL-24; PAY-01 to PAY-04 |
| Days, city groups, budget, transport, privacy, clones and PDF | `features/discovery/planner.tsx`, `day.tsx`, `plan-travel.tsx` | ITN-01 to ITN-28 as listed in the workbook |
| Drafts, publishing, images, tags, comments, reporting and author pages | `features/discovery/journal.tsx`, `shared.tsx` | BLG-01 to BLG-13, GEN-08 to GEN-10 |
| Administration and assigned providers | `features/staff`; administrator, flight and hotel controllers | ACC-13 to ACC-18, FLT-01 to FLT-09, FLT-29, HTL-01 to HTL-10, HTL-22, HTL-26, BON-01 |

Paths in this table are relative to `frontend/src` unless a backend service is named. The full list of individual workbook stories and backend mapping is in `docs/requirements/traceability.csv`. The design guides are a reference for screens and transitions. A reviewer can use the role walkthroughs to evaluate the running application against the actual acceptance criteria.

## Staff walkthrough

| Role | Actions to demonstrate | Boundary to verify |
| --- | --- | --- |
| Administrator | Inspect accounts and bookings, create a provider and its moderator, suspend or reactivate an account, handle a content report and inspect audit or analytics views | Administrative writes require an administrator session. Moderator assignments are provider-specific. |
| Airline moderator | Open the assigned airline, update profile and baggage or cancellation policy, create a future flight, manage cabins and inspect its passenger manifest | Inventory edits and booking data belong to the moderator's assigned airline. |
| Hotel moderator | Edit the assigned property, maintain rooms, block or unblock availability, update stay policies and inspect reservations and review replies | Availability, reservations, media and replies use the assigned hotel. |
| Guest | Browse flights, stays, public journal and public itineraries, then follow a protected action through sign-in | Private content and management workspaces remain scoped to authorized actors. |

Use a disposable provider and traveler for cancellation, moderation and suspension exercises. A provider cancellation or suspension can affect other records through the server. The human reviewer can record the role, action, observed outcome and any discrepancy for each scenario.

## Troubleshooting and extending a workflow

| Symptom | What to inspect |
| --- | --- |
| The page or API refuses the connection | Check the URLs printed by the launcher. Open the API health endpoint directly and trust the local certificate. Check both listening ports and the backend database connection. |
| Sign-in succeeds but a protected write fails | Keep the same localhost hostname and HTTPS scheme. Check the exact frontend origin in CORS_ORIGINS, session expiry and whether the shared API helper supplied the matching CSRF header. |
| Flight or stay search is empty | Check future travel dates, official airport or city identifiers, the number of guests and rooms, and the provider's actual saleable inventory. The photographs are editorial. |
| A held fare expires or payment remains pending | Reopen My trips and check the server state. For Stripe test payments, verify that the browser key, backend key and signed-webhook listener use the same sandbox. A signed success event or server reconciliation determines fulfillment. |
| A budget cannot be converted | Check the selected currencies, last published exchange-rate date and API service status. A missing exchange rate should surface as an error rather than a fabricated amount. |
| A file upload fails | Choose a JPEG or PNG within 5 MB and check the five-image limit and ownership of the parent resource. Private media requires an authenticated browser session. |

To change a workflow, start with the workbook ID, then compare the exported OpenAPI operation, DTO and controller with the matching feature form. Include the empty, success and rejected states. Exercise the owner and a different account on an isolated database. Rebuild the frontend and backend, and update the walkthrough and disclosure when the change is material.

The Git history and actual human review are separate course deliverables. Before submitting, check the current branch, files, tests and documented limitations, and confirm the selected GitHub version includes this frontend. Only the student's own review record can establish personal sign-off.

## Verification results

The table records the 25 November verification. The [acceptance report](ACCEPTANCE.md) links each course deliverable to its implementation or evidence. The browser suites drive the production frontend and a real HTTP API with disposable records.

| Check | Measured result |
| --- | --- |
| Backend tests | All 64 Jest tests passed. The suite covered pricing, permissions, visibility, exchange-rate loading, transaction handling and payment races. Both applications passed type checking and production builds. Backend lint passed. |
| REST operations | Successful workflows exercised all 151 operations in the current OpenAPI export across 125 paths. The integrated version adds an administrator provider directory and two protected provider inventory reads to the original 148 operations. |
| Browser workflows | All 17 Edge tests passed without skips or retries. They covered account validation, guest room and fare choices across sign-in, holds, flight tickets, public content without JavaScript, editing, and all three staff workspaces. |
| Hold expiry | A flight seat and two hotel room nights were held for ten real minutes. The normal background worker expired both unpaid reservations, returned the inventory and allowed the same seat capacity and room nights to be booked again. |
| Responsive behavior | Desktop (1360 px), tablet (834 px) and phone (390 px) checks passed. The phone test exercised navigation, horizontal overflow and the flight shortcut. Screenshots of the running desktop and phone homepage appear in the first chapter. |

To reproduce the browser run, install dependencies and build both projects, generate the local certificates and use Microsoft Edge. Run `npm.cmd run test:browser` from `frontend`. The harness starts web port 3300 and API port 3445, seeds disposable accounts and uses an isolated replica set. The seat and PDF scenario starts with a fixture-confirmed booking. External Stripe and SMTP services are disabled in that browser harness.

The [dated acceptance evidence](evidence/acceptance-2026-11-25.json) records the current run. The 24 November baseline remains in [backend-tests.json](evidence/backend-tests.json), [api-route-coverage.json](evidence/api-route-coverage.json), [browser-tests.json](evidence/browser-tests.json) and [live-checks.json](evidence/live-checks.json). This handbook retains the 20 November backend release on pages 1–105.

## Connected services and final review

The D: website and API were checked against their configured environment on 24 November 2026. The running API reported a database connection; the configured multi-host database URI points to Atlas. Read-only calls returned airport reference data and public journal records. A guest request to a protected staff directory returned HTTP 401.

| Dependency or gate | Evidence and remaining action |
| --- | --- |
| MongoDB Atlas | The live application reported a connected database. Read-only reference and journal checks succeeded. The browser regression suite used its own disposable MongoDB records. |
| Stripe sandbox | On 25 November a browser flight booking through Stripe Elements charged USD 180.00 in test mode. The API verified the signed event and confirmed the booking. Cancellation in the browser produced a USD 162.00 refund verified against Stripe. |
| Browser checkout demonstration | Set the matching publishable test key privately in the frontend, run the sandbox webhook listener and keep it open during a demonstration. The setup instructions above give the exact local commands. |
| Email | The 25 November service run delivered account verification, recovery and booking notifications to a local SMTP inbox. |
| Human review and delivery | The sole student reviews the source and explains the architecture at evaluation. A first-time participant can provide additional usability evidence. The acceptance report distinguishes these observations from the automated checks. |

The workbook contains 104 mandatory requirements and 11 bonuses. Component mapping, browser scenarios and successful API operations provide different levels of evidence. The student can record remaining manual acceptance scenarios by workbook ID with the role, inputs, observed result, date and build used.

For the active integrated checkout, open `https://localhost:3000` for the website and `https://localhost:3444/api/docs` for Swagger. The review branch is `feature/milestone-2-frontend`. The course workflow places student review before integration into `develop` and release to `main`.
