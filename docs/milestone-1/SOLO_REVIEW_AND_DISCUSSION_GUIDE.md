# Solo student review and discussion guide

You are the only human student/developer. This guide supports your own review under section 11.2; it does not assume another teammate. Completed checklist items describe only confirmations actually supplied. Personal executions without recorded details remain open.

**20 November 2026 update:** Existing student-entered notes are preserved below. The additional explanations are AI-assisted and based on the source at commit `2bc6170344ab030be7e3899d5e0bfdab7ea55e62`. The earlier explanations also received assistance in this conversation. The student explicitly approved including the written explanations and completing the documentation/package. Suggested checks do not establish personal execution of each test. The [approval and test record](STUDENT_APPROVAL_AND_TEST_RECORD.md) distinguishes the owner's approval, reported Swagger use and recorded assistant/automated results.

## Record the actual version

Run `git rev-parse HEAD` and review that version and its material AI contributions. AI self-review and tests support your review; they do not certify it.

Project baseline associated with approval: **`2bc6170344ab030be7e3899d5e0bfdab7ea55e62`**. The final package manifest identifies the packaged documentation revision. The version used for the student's personal Swagger session was not supplied.

Student reviewer: **sole repository owner, Git identity `stevenraouf`**. Formal student name/ID was not supplied. Approval recorded: **20 November 2026**. Actual personal Swagger execution date was not supplied.

### Student-reported progress

Report recorded on **20 November 2026**. The student stated in this conversation that they personally checked Swagger. The actual execution date, reviewed commit, application roles, endpoint/workflow list, response codes and individual outcomes were not supplied. This records the student's report without converting it into an all-API pass or completed role walkthrough.

Student response, paraphrased from the actual messages: **I personally checked Swagger. I approve including the supplied written explanations and completing the documentation/package. The written explanations were prepared with AI assistance.** Detailed endpoint-level personal observations were not supplied. Approval is recorded on 20 November; it is not backdated to earlier integration.

## Explain the implementation

### Architecture and MVC

Source: [Modules](../../backend/src/app.module.ts)

Question: How do controllers, DTOs, services and models implement MVC? Why one backend and database?

Here is My answer :

for the "Controller": it Handles HTTP routes , receives  validated inputs and calls the appropriate service. Example : file "bookings.ts" starting from "FlightBookingsController"it handles flight booking endpoints

for the "DTO" it defines the accpeted request and structure  and validation rules.DTO means Data Transfer Object. Example : file "dto.ts" starting from "FlightBookingDto"

for the "Service" : Implements business rules and coordinates database operations. This belong to the business side of MVC's Model layer. Example : file "booking.ts" starting from " async holdFlight" coordinates  inventory reservation and booking creation.

for the "Model" : Define stored data , schema rules and indexes, and provide database operations through Mongoose. Example: file "database.ts" starting from "define(
  "Booking", "defines booking fields and allowed states.

 for the "View" : Presnet information to the user. The full application interface belongs to the milestone 2 frontend. Example : this backend returns JSON. Swagger provides API documentation and a testing interface.

**Additional AI-assisted explanation for the architecture question:** The backend is a modular monolith: one NestJS application contains separate authentication, flight, hotel, booking, payment and other feature modules. This simplifies setup and operation for a solo project, shares authentication and validation, and lets itinerary features reuse search services directly. One Atlas application database contains many collections. Inventory changes and booking creation can use the same connection and transaction session. Separate disposable databases are used for automated tests. The tradeoff is a shared deployment and database; independently deploying or scaling individual features would require further separation.

### Schemas and consistency

Source: [Schemas](../../backend/src/database.ts)

Question: Why embed cabins/days but reference bookings/comments? What do transactions and unique indexes guarantee?

Here is my answer: Embedding means storing related data inside its parent document. Referencing means storing another document’s ID. We choose between them based on ownership, size and how the data is used.

Cabins embedded in a flight: A flight has a small set of cabin categories. Their capacity, prices and baggage rules belong to that flight and are usually read together.

Days embedded in an itinerary : Days belong to one itinerary, have a meaningful order and are limited to 60. Embedding makes reordering, cloning and calculating the trip easier.

Bookings stored separately : Booking history grows over time. Each booking has its own owner, payment, status and cancellation lifecycle, and must be searchable by travelers, providers and administrators.

Comments stored separately : A post can accumulate many comments. Separate documents allow pagination, editing and moderation without continually enlarging the post document.

  All these strucures can be seen in the file database.ts (line 143)

A booking also embeds historical snapshots of passengers, prices and policies. Its references identify related accounts/providers, while its snapshots preserve the agreed terms when providers later edit their data.

Transactions guarantee that participating database changes succeed or fail together.

For a round-trip hold, the backend must reserve outbound seats, reserve return seats and create the booking. If the return flight is unavailable, the outbound reservation is rolled back too. A hotel hold similarly acquires every requested room-night and creates the booking together. See [the hold implementation (line 60)](../../backend/src/bookings/bookings.ts).

All those operations must use the same transaction session. MongoDB provides multi-document ACID transactions; isolation and durability also depend on the configured read/write concerns. MongoDB transaction documentation

Transactions do not automatically validate every business rule. Our services still check availability and permissions, and flight inventory uses conditional updates to handle competing requests. Stripe payments and emails occur outside MongoDB transactions and need their own retry/idempotency handling.

Unique indexes guarantee that duplicate indexed keys cannot coexist across documents, once the indexes are successfully created. MongoDB enforces this during concurrent writes too. MongoDB unique-index documentation

| Unique key | What it prevents |
| --- | --- |
| `roomId + date` | Two allocations for the same room-night |
| `postId + userId` | The same user liking the same post twice |
| `bookingId` on reviews | Multiple reviews for one reservation |
| Stripe `eventId` | Multiple stored processing records for the same webhook event |

The distinction matters: the unique room-night index prevents conflicting allocations; the transaction prevents a partially completed reservation. Both are needed.

### Authentication and sessions

Source: [Authentication](../../backend/src/auth/auth.ts)

Question: Explain salted hashing, lockout, access expiry, inactivity, refresh rotation and forced password changes.

Here is my answer : These mechanisms protect different stages of authentication. The timings below match the actual code.
1.  Salted password hashing
   When a password is created or changed, the backend generates a random 16-byte salt and uses scrypt to derive a hash. It stores :

   scrypt:<salt>:<hash>

   The salt makes two identical passwords produce different stored hashes. Scrypt makes password guessing computationally expensive. During login, the backend recalculates the hash using the stored salt and compares it using timingSafeEqual. It never needs to decrypt a password.

See [password hashing (line 48)](../../backend/src/auth/auth.ts).

2.  Login lockout

    Incorrect passwords increment failedLogins in MongoDB. The fifth failure locks login for 15 minutes, including attempts using the correct password during that period.

    A successful login clears the failure count and lockout timestamp. This slows repeated password guessing. The counter lives on the server, so refreshing the browser does not reset it

3.  Access-token expiry

    Successful login issues a signed JWT valid for 15 minutes, stored in an httpOnly, Secure, SameSite=Lax cookie.

    The JWT identifies the user and session. For protected requests, the server checks its signature and expiry, then checks the database session and current account status. Consequently, a valid JWT alone cannot bypass session revocation or account suspension

4. Inactivity expiry

    The database session contains lastActiveAt. Accepted authenticated requests update it.

    After 30 minutes without accepted activity, both protected access and refresh are rejected. The user must log in again.

    Here, activity means requests observed by the backend. Moving the mouse or leaving Swagger open does not count; a successful refresh request does count

5.  Refresh-token rotation

    Refresh allows an active session to obtain a new access token after the previous one expires.

    The refresh token contains a session ID and a cryptographically random secret. MongoDB stores a SHA-256 hash of that secret. Refresh verifies the token, session, inactivity limit, account status and CSRF header.

    On success, an atomic database update replaces the refresh-token hash and CSRF-token hash, and new cookies are issued. The previous refresh token then fails if reused.

    See [cookie issuance and refresh (line 177)](../../backend/src/auth/auth.ts).

6. Forced password changes
   Administrator-created moderator accounts and administrator password resets set forcePasswordChange = true.
   The account can log in, inspect its identity, change its password and log out. Protected business actions return 403: Password change required until the change is completed.
   A successful change verifies the current password, creates a fresh salted hash, clears the flag, revokes all existing sessions and clears cookies. The user then logs in again.
   See [password changes (line 239)](../../backend/src/auth/auth.ts) and [guard enforcement (line 406)](../../backend/src/auth/auth.ts).
    The key distinction: access expiry happens after 15 minutes even while someone is active; refresh maintains an eligible session. After 30 minutes of inactivity, refresh also fails

## Additional AI-assisted explanations

The following twelve AI-assisted answers are approved for inclusion in this guide. Suggested checks describe expected behavior; they are not completed student test records. The student should verify the explanations reflect their own understanding before presenting them during evaluation.

### HTTP configuration

Source: [bootstrap.ts](../../backend/src/bootstrap.ts) and [auth.ts](../../backend/src/auth/auth.ts).

Question: Explain httpOnly/Secure/SameSite cookies, CSRF versus authentication, server validation and Swagger credentials.

Answer (AI-assisted): The access and refresh cookies use `httpOnly`, `Secure` and `SameSite=Lax`. `httpOnly` prevents JavaScript from reading the credentials, although the browser can still send them with requests. `Secure` restricts transmission to secure connections, with browser localhost exceptions; this application explicitly runs on HTTPS. `SameSite=Lax` restricts cross-site cookie sending while allowing cases such as following a normal link to the site. These flags reduce exposure and are used alongside other checks.

Authentication establishes the account identity using the access token and database session. Authorization checks the account's permitted role and relationship to the resource. CSRF protection helps prevent another site from using an already authenticated browser to perform an unwanted action. For protected requests that change data, the guard hashes `X-CSRF-Token` and compares it with the session's stored CSRF hash. Refresh performs its own CSRF check. The separate CSRF cookie is intentionally JavaScript-readable so Swagger can copy its value into that header. Having a CSRF token alone does not authenticate an account.

The global `ValidationPipe` enforces DTO rules at runtime and rejects unexpected properties. Services enforce business rules and ownership; database constraints enforce uniqueness. Swagger's schema documents inputs, while the server enforces them. Adding `role: "Admin"` to traveler registration does not grant that role because the DTO rejects the extra field.

Swagger uses `withCredentials: true` and a request interceptor. Logging in through `/api/auth/login` sets the browser cookies, and the interceptor adds the CSRF header. Login uses application credentials, not Atlas passwords or Stripe keys. There is no need to paste access/refresh tokens into Authorize. `/api/auth/me` confirms the current account and role; lock icons describe endpoint requirements.

Suggested check to record personally: Log in, inspect `/api/auth/me`, perform a permitted write, and inspect its CSRF header. A controlled missing-CSRF test should fail with 403 on a protected write. Record the actual endpoint and response, without recording credentials.

### Provider permissions

Source: [manageProvider and flight services](../../backend/src/flights/flights.ts), [hotel services](../../backend/src/hotels/hotels.ts), [role guard](../../backend/src/auth/auth.ts) and [moderator creation](../../backend/src/admin/admin.ts).

Question: How are roles different from ownership/assignment? Why cannot moderator A edit provider B?

Answer (AI-assisted): A role permits a type of operation. Ownership or assignment limits the specific records on which the account may perform that operation. Two travelers have the same role but cannot manage each other's bookings. Two airline moderators have the same role but manage their respective assigned providers.

The guard checks the endpoint's `@Roles` requirement. The service then loads the actual provider and calls `manageProvider`, which requires both the matching moderator role and a matching `providerId`. That assignment comes from the account loaded from MongoDB. An administrator creates a moderator with one provider assignment and validates the provider type. Changing the target URL does not change the stored assignment.

For a flight, the service loads its actual airline before checking assignment. For a room, it checks the hotel assignment and also that the room belongs to that hotel. Therefore, a moderator assigned to A cannot edit B, even when both providers have the same type. Traveler booking ownership similarly compares the booking's `userId` with the authenticated account's ID.

Suggested check to record personally: Using synthetic providers A and B, valid credentials/CSRF and a completed temporary-password change, confirm that editing A succeeds and editing B returns the assigned-provider 403 error. Confirm B is unchanged. A generic 403 caused by missing CSRF would not independently demonstrate assignment enforcement.

### Inventory

Source: [inventory.ts](../../backend/src/bookings/inventory.ts), [booking holds](../../backend/src/bookings/bookings.ts), [room-night indexes](../../backend/src/database.ts) and [concurrency tests](../../backend/test/integration/platform.spec.ts).

Question: Demonstrate last-seat contention, all-or-nothing round trips/multiple rooms and half-open stay dates.

Answer (AI-assisted): Flight cabins track `capacity`, `held` and `booked`. Available seats are calculated from capacity minus both held and booked seats. `acquireFlights` uses a conditional update that checks the inventory values it read, inside a database transaction. Competing writes cannot both successfully reserve the same final capacity. A conflict is rejected or the transaction is retried against current state.

`holdFlight` reserves every selected segment and creates the booking using one transaction session. If either direction of a round trip is unavailable, there is no partial successful reservation. Hotel inventory uses one `RoomNight` document for each selected room and occupied date. The unique `(roomId, date)` index prevents duplicate allocations; the transaction ensures that every selected room-night and the booking are acquired together.

Hotel dates are half-open: `[checkIn, checkOut)`. For example, a stay from 20 to 23 December consumes the nights of 20, 21 and 22 December. Another stay may begin on 23 December. It does not overlap the first stay's room-nights.

Ten-minute holds are checked using timestamps and a worker. Correctness does not depend on immediate TTL deletion. Expiry changes state and releases inventory together, with guards that prevent repeated release.

Suggested checks to record personally: The automated scenarios send two simultaneous requests for the last seat and expect one 201 and one 409, with exactly one seat held. Other scenarios make the return flight unavailable or one requested hotel room unavailable and check that no partial allocation remains. The adjacent-stays scenario expects both reservations to succeed. Swagger can demonstrate sequential availability and adjacency; actual concurrency needs parallel requests or the integration test, not two sequential clicks. Do not change dates or completion states directly in the application database to simulate these tests; use the disposable test environment.

### Bookings

Source: [bookings.ts](../../backend/src/bookings/bookings.ts), [inventory lifecycle](../../backend/src/bookings/inventory.ts) and [refund tier selection](../../backend/src/common.ts).

Question: Explain snapshots, lifecycle, cancellation deadlines, refund tiers and completion.

Answer (AI-assisted): A hold stores a snapshot of the selected travel details, passengers or guests, prices and applicable policies. It also stores the calculated amount and currency. Later provider price/policy edits do not silently replace the terms recorded for that booking.

The main lifecycle is `Pending Payment -> Confirmed -> Completed`, with `Pending Payment -> Expired` at the original hold deadline and eligible `Confirmed -> Cancelled` transitions. Verified payment processing creates confirmation and a booking reference. A client request cannot simply declare the booking paid or completed.

Provider flight cancellation invalidates unpaid holds and releases their inventory once. Such a booking remains `Pending Payment` until its original deadline, with `holdInvalidatedAt` recording that payment is blocked. It then becomes `Expired`. A successful payment that cannot be fulfilled is compensated rather than recreating released inventory. This is the GEN-11 correction recorded in the release audit.

Traveler cancellation requires an owned, Confirmed booking before the permitted deadline. Flight calculations use whole 24-hour periods before departure; hotel calculations use hotel-local calendar dates and prohibit cancellation on/after the check-in date. `refundPercent` selects the highest snapshotted threshold that the remaining days satisfy, or zero when none applies. Cancellation releases the reservation and records the eligible refund. Provider flight cancellation gives confirmed affected bookings a full refund. Provider deactivation is a separate operation and preserves existing confirmed bookings.

Completion is derived from travel/stay timing. Flight bookings complete after their recorded end. Hotel completion also requires the hotel-local check-out date to have passed; the current code does not mark a stay Completed at the beginning of check-out day. Completion enables eligible hotel reviews. Repeated cancellation is guarded to avoid duplicate inventory release and refunds.

Suggested check to record personally: Hold a test booking, inspect its snapshots and policy quote, change a provider's current price, and confirm the held amount is unchanged. Record the actual cancellation quote, cancellation status and eventual refund status separately.

### Payments

Source: [payments.ts](../../backend/src/payments/payments.ts), [flight changes](../../backend/src/bookings/bookings.ts) and [refund allocation](../../backend/src/bookings/inventory.ts).

Question: Why not trust client success? Explain raw-body signatures, amount/currency checks, replay handling, compensation and repeated changes.

Answer (AI-assisted): Browser responses can be changed or forged, so booking confirmation is based on Stripe evidence verified by the backend. The public webhook endpoint passes the unchanged raw body and `stripe-signature` header to Stripe's signature verifier using the private signing secret. It rejects invalid signatures and live-mode events in this test-mode application. Public here means that it does not use a travel-account login; the Stripe signature is still required.

For a success event, the service checks successful status, the expected amount in minor units, currency, booking association and Stripe PaymentIntent identity. It checks that the hold can still be fulfilled. Event processing, local payment state, inventory conversion, booking confirmation and notifications are coordinated in a database transaction.

The unique Stripe event ID and `processedAt` prevent replaying a processed event from applying the effects again. Payment status and booking state also guard against different events repeating the same logical success. Stable Stripe idempotency keys are used for external payment/refund operations. If payment succeeds after expiry or invalidation, the service records a compensating full refund and keeps released inventory unavailable to that old booking.

Flight changes reserve replacement inventory while the original confirmed booking remains valid. A higher fare requires accepted replacement policies and a successful fare-difference payment; a cheaper fare records the applicable refund. Revision checks prevent a stale change from overwriting a newer booking state. Only one pending change per booking is allowed. Committing a change preserves the booking reference, releases old inventory and removes old seat assignments. Later changes use the current booking revision and amount. Refund allocation accounts for earlier successful payments/refunds rather than issuing unlimited repeated refunds.

Suggested check to record personally: Use Stripe sandbox PaymentIntents and actual signed webhook forwarding. Record confirmation and cancellation/refund results from both the application and Stripe. The backend must not receive raw card details. Existing fixture-based success events are useful automated evidence but are not a substitute for this external-service check.

### Background jobs

Source: [jobs.ts](../../backend/src/jobs.ts), [outbox/notification helpers](../../backend/src/ops.ts) and [Stripe recovery work](../../backend/src/payments/payments.ts).

Question: Why keep external calls outside transactions? Explain operation keys, leases, retry and crash recovery.

Answer (AI-assisted): MongoDB cannot roll back a Stripe API call or an email already sent. Network delays would also hold a database transaction open unnecessarily. The application records durable external work in `Outbox`, alongside related state when a transaction is supplied, and processes the network operation afterward.

An operation key identifies the logical work. `enqueue` uses an upsert plus a unique key, and Stripe requests use stable idempotency keys. The worker atomically claims due work or expired leases, marks it Running, increments attempts and assigns a two-minute lease. Successful work is marked Done. Failed work returns to Pending with capped exponential backoff. A crashed worker's expired lease can be reclaimed after restart because the work is stored in MongoDB rather than only in memory.

The worker normally checks expiry, completion and queued work every ten seconds. Exchange-rate checks run hourly and refresh when the last successful fetch is at least a day old. Database guards still matter when multiple workers or retried operations compete. A lease covers a time period rather than guaranteeing that an external effect happens exactly once. Stripe idempotency/reconciliation protects repeated financial requests; email could be delivered twice if a crash occurs after delivery but before the job is marked Done. A terminal Stripe refund failure remains visible for operator reconciliation.

Suggested check to record personally: Inspect a test outbox record's state, attempts and retry time during a controlled service failure, then restore the service and observe recovery. Keep actual external service outages and manual test results separate from historical fixture evidence.

### Itineraries

Source: [itineraries.ts](../../backend/src/itineraries/itineraries.ts) and [exchange-rate cache](../../backend/src/ops.ts).

Question: Explain derived dates, ordering/groups, budgets, FX fallback and independent clones without private booking IDs.

Answer (AI-assisted): Days are an ordered array owned by the itinerary, limited to 60. A displayed day number and date are calculated from its array position and the itinerary start date. Reordering must include each day exactly once. Consecutive days in the same city form a city group; revisiting that city later produces another group. Deletion removes that day's dependent transport entries and booking links. These derived values avoid maintaining separate editable dates that could become inconsistent.

The budget combines manual category entries, activity costs, intercity transport and each linked eligible booking once. A booking can be linked only once to that itinerary and must belong to its owner. Category, day and city-group totals are calculated from the same expense entries. The system cannot infer that two separately entered manual expenses describe the same real-world purchase, so the student should avoid manually duplicating an automatically linked cost.

Currency conversion uses cached USD-based rates: divide the source amount by its source rate, then multiply by the preferred-currency rate. The response exposes the rate date/fetch time. Failed refresh does not overwrite the last successful cache. If conversion needs rates and there is no usable cache/rate, it reports unavailability rather than silently using zero. An itinerary can still be returned with an unavailable-budget explanation for a missing cache.

Only public itineraries can be cloned. A clone has a new owner and fresh day/activity/budget IDs, starts Private, and retains attribution to its source author. Public responses remove private booking links. Cloning turns linked booking costs into independent numeric expenses rather than copying another person's private booking IDs. New media records can reference the same immutable files; editing/deleting the original itinerary does not edit the clone's documents. Flight/hotel itinerary searches reuse the existing search services.

Suggested check to record personally: Reorder/delete days, revisit a city, compare calculated totals, clone a public itinerary and edit the original. Check privacy and the clone's lack of private booking references. Record the actual dates, totals and access outcomes observed.

### Community

Source: [community.ts](../../backend/src/community/community.ts), [author labels](../../backend/src/ops.ts), [itinerary access](../../backend/src/itineraries/itineraries.ts) and [unique interaction indexes](../../backend/src/database.ts).

Question: Explain draft/privacy, one like/report/review rules, review eligibility and deactivated-author labels.

Answer (AI-assisted): A public post must be Published, visible and written by an account that is not deactivated. The post owner and administrator can inspect drafts/hidden posts through the relevant access rules. Editing requires ownership. Itinerary access separately requires public visibility or ownership; administrator moderation does not automatically grant access to every private itinerary.

Likes are unique per `(postId, userId)` and can be removed. Reports are unique per `(userId, contentType, contentId)`. Reviews are unique per hotel booking, regardless of its room count. Review creation verifies an owned Completed hotel reservation; a future or cancelled reservation is not eligible. Review changes and moderation recalculate the hotel's rating. Only the assigned hotel moderator may reply.

Comments/reviews from deactivated authors use the shared `Deleted user` label and suppress their public author ID. Deactivation also removes the author's posts/itineraries from public discovery. Suspension is separate and does not automatically apply deactivation visibility rules. Public blog search ranks using likes plus visible comments, then recency. Attached itinerary access is checked when the post is read.

Suggested check to record personally: Attempt another user's draft, a duplicate like/report, an ineligible review and a reply from the wrong hotel moderator. Use the controlled completed-stay test fixture for historical review eligibility; there is no public API for forging completion.

### Administration

Source: [admin.ts](../../backend/src/admin/admin.ts), [account deactivation](../../backend/src/auth/auth.ts), [content removal](../../backend/src/community/community.ts) and [audit helper](../../backend/src/ops.ts).

Question: Explain separate account/provider status, reports, hiding/deletion and audit records.

Answer (AI-assisted): Account status controls a person's ability to authenticate and act. Suspension blocks authenticated access and revokes sessions; reactivation restores an eligible account. Self-deactivation has its own rules, including the upcoming-confirmed-booking restriction and public-content behavior. Provider status is a separate `active` flag on an airline/hotel. Deactivating a provider blocks new eligible booking/confirmation flows and notifies affected users/moderators, while preserving existing confirmed bookings. It does not itself suspend the assigned moderator or cancel all reservations.

An administrator can dismiss a report or hide/delete its target. A report can be resolved only while Open and records the resolving administrator. Hiding keeps the record while restricting visibility according to the content's access rules, including owner/admin exceptions and underlying privacy. Deletion removes the target document and relevant dependent data, such as a deleted post's comments/likes or a review's rating contribution.

Audit records contain the acting administrator, action, target, time and applicable details. Account/provider status changes and report resolution include their associated audit records in their transactions. Audit logs provide a review trail; the application does not claim cryptographic tamper-proof logging. Administrative routes have their own role checks rather than allowing all users to change status or resolve reports.

Suggested check to record personally: As administrator, resolve a synthetic report, inspect the changed visibility and audit record, and verify that a traveler cannot perform the same administrative operation. Compare account suspension with provider deactivation without using real customer records.

### Media

Source: [media.ts](../../backend/src/media/media.ts).

Question: Why not trust the file extension? Explain decoding/size/count checks and private-parent access.

Answer (AI-assisted): A filename or declared MIME type can be changed without changing the file's bytes. `validateImage` therefore checks the PNG/JPEG signature, the matching declared MIME type and successful image decoding. Corrupt files, empty files, unsupported formats and files larger than five MiB are rejected. Safe decoding limits include a 20-megapixel limit and a bounded JPEG decoding memory setting; PNG decoding checks its CRC.

The limits are five images per post, activity or hotel, and one airline logo. Upload handling checks the parent owner/provider assignment, uses a generated UUID filename and rechecks the parent/count while updating its media references in a transaction. If that database operation fails, the newly written file is removed.

Files are served through `/api/media/:id`, which checks the current parent visibility and uses `private, no-store` caching. The storage folder is not exposed as an unrestricted static directory. Knowing an image ID does not bypass a private itinerary or hidden-post access rule. Removing media checks that it belongs to the requested parent. Some immutable files can be shared by clone media records, so removal retains shared storage files for future safe garbage collection rather than deleting every referenced file immediately.

Suggested check to record personally: Upload a valid image, a renamed non-image and a sixth image; then try another user's private activity image. Record actual responses without including private content in the review evidence.

### Seeds

Source: [seed.ts](../../backend/src/seed.ts) and [official reference records](../../backend/data/reference.json).

Question: Explain official identifiers, idempotency, admin seeding and demo accounts versus contributors.

Answer (AI-assisted): Reference seeding reads the supplied cached official data and preserves identifiers such as airport IATA codes, city IDs, country codes and attraction IDs. It uses those identifiers as upsert keys. Repeating reference seeding updates the matching records instead of adding duplicates. Supported currencies are derived from country records.

The administrator is seeded from private local configuration, with the password stored as a salted hash. There is no public administrator registration endpoint. `$setOnInsert` creates the administrator only when it is absent; rerunning the seed or editing `ADMIN_PASSWORD` does not replace the password on an existing account. Existing administrator password changes must use the appropriate authenticated flow.

Optional demo seeding is separate from official reference seeding, creates synthetic travel providers/accounts and is forbidden when `NODE_ENV=production`. The demo accounts use the configured seed password; moderators require a password change. They are application test actors, not additional students, developers or Git contributors. The project has one human student and disclosed AI assistance. Demo flight dates are relative to the run date, so a later demo run can create new dated examples even though official reference seeding remains idempotent.

Suggested check to record personally: Run official/reference seeding twice in a disposable environment and compare counts and identifiers. Inspect the administrator creation behavior without printing any private configuration. Do not assume rerunning the seed rotates an existing password.

### Integration tests and evidence

Source: [platform.spec.ts](../../backend/test/integration/platform.spec.ts), [API coverage observer](../../backend/test/api-coverage.ts), [API report](API_TEST_REPORT.md), [Stripe verification](STRIPE_VERIFICATION_REPORT.md) and [bonus verification](BONUS_VERIFICATION.md).

Question: What uses real MongoDB? What uses Stripe/SMTP fixtures? What requires account-backed evidence?

Answer (AI-assisted): The HTTP integration suite starts an actual disposable MongoDB replica set using `MongoMemoryReplSet`, not a mocked database. Supertest sends requests through the Nest application, so schemas/indexes, transactions, guards, DTO validation and services execute together. The suite uses isolated data and must not be pointed at the application Atlas database for destructive scenarios.

Repeatable payment/email edge cases use fixture adapters and synthetic test events. For example, `markPaid` exercises local processing with a constructed event; that alone does not prove Stripe delivered a signed webhook. Other tests exercise signature validation and failure cases with controlled test inputs. Synthetic users, providers and completed hotel stays are fixtures, not real customers or historical travel.

Separate live verification records establish actual Atlas connectivity, Stripe sandbox payments/refunds and signed-event delivery, FX retrieval and SMTP delivery to the local Mailpit inbox. The 19 November engineering evidence records 57 passing tests and successful workflows for all 148 API operations, plus additional role/CSRF checks and live bonus verification. Those are recorded assistant-executed results, not a claim that the student reran them today. SMTP delivery to a local inbox is not proof of delivery to a personal/internet mailbox. Successful operation coverage also does not exhaust every possible input or race.

Suggested check to record personally: Run the documented typecheck, lint, test and build commands; record their actual outputs and reviewed version. Follow the role-by-role Swagger walkthrough and compare the separate external-service receipts. Use private configuration and omit passwords, cookies, raw tokens, card details and secret keys from recorded evidence. Any failed or unperformed check should remain visible.

## Perform your review

- [x] Owner explicitly approved including the supplied written explanations and completing the documentation/package on 20 November 2026.
- [x] Student reported personally using Swagger; this item records that statement only, not a complete all-role/API pass.
- [ ] Read `AI_PROMPTS.txt`, verify the disclosure and add any other AI conversations/tools you used.
- [ ] Read the source and answer the questions above in your own words; record unclear parts honestly.
- [ ] Run type checking, lint, tests and build; record actual results rather than treating earlier reports as your own execution.
- [ ] Follow the [Swagger walkthrough](../api/SWAGGER_WALKTHROUGH.md) for all application roles. These roles do not imply multiple student developers.

  Progress reported by the student on 20 November: Swagger was personally checked. Completion of every role/workflow and the observed results are not yet documented, so the full walkthrough checkbox remains open.

- [ ] Configure Atlas and record connection/seed evidence without exposing credentials.
- [ ] Exercise actual Stripe test-account confirmation, cancellation and refunds; keep raw card details out of the backend.
- [ ] Verify actual SMTP inbox delivery if submitting email bonuses.
- [ ] Read the [coverage audit](COVERAGE_AUDIT.md), including the booking-state interpretation; record an instructor answer if needed.
- [ ] Resolve important findings before submission. For future AI changes, record your review before merging.
- [ ] Push genuine solo development history to your GitHub repository; do not invent contributors, earlier reviews or old commits.

## Findings and outcome

| Area / requirement | Observation | Correction or question | Actual retest result |
| --- | --- | --- | --- |
| Personal Swagger check | Student reports personally checking Swagger; recorded 20 November 2026 | Add actual execution date/version, roles, endpoints, responses and any problems observed | Individual outcomes not supplied |
| Written implementation explanations | Three existing student-entered answer sections retained; the architecture supplement and twelve remaining technical answers are AI-assisted | Owner approved inclusion on 20 November; student should confirm understanding and record any corrections | Inclusion approved; independent demonstration not recorded |
| Preserved engineering results | Actual assistant/automated results are listed in the approval and test record with their real actors and dates | Use recorded evidence without attributing an unperformed execution to the student | Historical engineering pass; no new personal run asserted |

Review outcome: **Owner approval for explanations and documentation/package finalization recorded on 20 November 2026. Personal Swagger use is reported; individual personal test results are not supplied.**

No earlier student review is being retroactively asserted for the existing AI-assisted integration baseline. Approval, individual test execution and instructor acceptance remain distinct facts. See the [approval and test record](STUDENT_APPROVAL_AND_TEST_RECORD.md).
