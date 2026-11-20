# Milestone 1: completed written solo-review answers

Prepared on **20 November 2026**, Africa/Cairo.

Reviewer identity available: **sole repository owner, Git identity `stevenraouf`**. A formal student name/ID was not supplied. Project version described: **`671344eada53b731d665dd854182017bcac81072`**. This identifies the implementation described, not an invented version/date for personal testing.

These fifteen written answers were prepared with Codex assistance from the actual implementation and existing review notes. All technical questions are answered. The recorded student statements, automated results and remaining personal details are separated below. This completed copy leaves the original guide and any unsaved editor buffer untouched.

## Technical answers

### Architecture and MVC

Source: [Modules](../../backend/src/app.module.ts), [DTOs](../../backend/src/dto.ts), [booking services/controllers](../../backend/src/bookings/bookings.ts) and [models](../../backend/src/database.ts).

Question: How do controllers, DTOs, services and models implement MVC? Why one backend and database?

Answer: The implementation is a layered REST backend that follows MVC's separation of responsibilities. Controllers handle HTTP routes, receive validated inputs and call services. DTOs define accepted request fields and runtime validation. Services implement business rules and coordinate database operations; this is part of the business side of the Model layer. Mongoose models define stored documents, schema rules and indexes. The backend returns JSON, and the full user interface belongs to the Milestone 2 frontend. Swagger documents and exercises the API.

For a flight hold, the guard checks the session, role and CSRF header, the DTO validates the request, the controller calls `BookingsService.holdFlight`, and the service coordinates quoting, inventory reservation and booking creation. The inventory changes and booking are committed in one transaction, then returned as JSON. Controller and service classes can share a feature file while keeping separate responsibilities.

One modular NestJS backend simplifies configuration, testing and operation for a solo project. Modules share authentication/validation and can reuse services directly, such as itinerary flight/hotel searches. One Atlas application database contains many collections, and related inventory/booking changes use one connection/session. Automated tests use separate disposable databases. The tradeoff is a shared deployment/database; independently deploying or scaling individual features would require further separation.

### Schemas and consistency

Source: [Schemas and indexes](../../backend/src/database.ts), [booking holds](../../backend/src/bookings/bookings.ts) and [inventory](../../backend/src/bookings/inventory.ts).

Question: Why embed cabins/days but reference bookings/comments? What do transactions and unique indexes guarantee?

Answer: Embedding stores related data inside its parent document. Referencing stores another document's ID. Cabins are a small set of data owned by one flight and usually read with it. Days are ordered itinerary-owned details, limited to 60; embedding simplifies reordering, cloning and calculations. Bookings and comments grow over time and need their own searches, pagination, permissions and lifecycle, so they are separate documents linked by IDs.

A booking also embeds historical passenger/guest, fare and policy snapshots. References identify shared records, while snapshots preserve the recorded terms after provider edits.

Transactions make participating database changes commit or roll back together. A round-trip hold reserves both directions and creates its booking with the same transaction session. If one segment fails, there is no partial outbound reservation. A multi-room hold similarly acquires every selected room-night and its booking together. Correctness also requires conditional inventory updates and service rules; transactions alone do not validate every business condition. Stripe calls and emails are outside MongoDB transactions and need retry/idempotency handling.

Unique indexes enforce the specified keys across documents, including competing writes:

| Unique key | What it prevents |
| --- | --- |
| `roomId + date` | Two allocations for the same room-night |
| `postId + userId` | Duplicate likes by the same user on a post |
| `bookingId` on reviews | Multiple reviews for one reservation |
| Stripe `eventId` | Duplicate stored event-processing records |

The room-night index prevents conflicting allocations, while the transaction prevents partial reservations. References still need service checks for existence, ownership and eligibility. MongoDB supplies ACID transaction semantics according to its configured read/write concerns; a unique index is not a foreign-key or general business-rule check.

### Authentication and sessions

Source: [Authentication and session guard](../../backend/src/auth/auth.ts) and [administrator resets](../../backend/src/admin/admin.ts).

Question: Explain salted hashing, lockout, access expiry, inactivity, refresh rotation and forced password changes.

Answer: Passwords use scrypt with a random 16-byte salt. The stored format is `scrypt:<salt>:<hash>`. Identical passwords get different hashes because of their salts. Login recalculates the hash with the stored salt and compares it using `timingSafeEqual`; there is no password decryption.

Five incorrect password attempts lock login for 15 minutes. The counter is stored in MongoDB. A successful login clears failures and the lockout timestamp. Refreshing the browser does not reset the server counter.

A successful login issues an access JWT valid for 15 minutes in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. It identifies the user/session, and protected requests also check the current database session and account status. Revocation or suspension can therefore block access before the JWT's expiry.

Sessions store `lastActiveAt`. Accepted authenticated requests update it. After 30 minutes without accepted activity, protected access and refresh are rejected. Activity means server-observed requests, not mouse movement or an open Swagger page; a successful refresh counts as activity.

Refresh credentials include a session ID and a random secret whose SHA-256 hash is stored server-side. Refresh checks that secret, account/session status, inactivity and CSRF. An atomic update rotates the refresh-token hash and CSRF-token hash, then issues new cookies. Reusing the old refresh secret fails. Access expiry and inactivity are separate: an active session can refresh an expired access JWT, while an inactive session must log in again.

Administrator-created moderators and administrator temporary resets set `forcePasswordChange=true`. The account can inspect its identity, change its password and log out, but protected business actions are blocked until the change. A successful password change checks the current password, creates a fresh salted hash, clears the flag, revokes all sessions and clears cookies. The account logs in again afterward.

### HTTP configuration

Source: [bootstrap.ts](../../backend/src/bootstrap.ts) and [auth.ts](../../backend/src/auth/auth.ts).

Question: Explain httpOnly/Secure/SameSite cookies, CSRF versus authentication, server validation and Swagger credentials.

Answer: The access and refresh cookies use `httpOnly`, `Secure` and `SameSite=Lax`. `httpOnly` prevents JavaScript from reading the credentials, although the browser can still send them with requests. `Secure` restricts transmission to secure connections, with browser localhost exceptions; this application explicitly runs on HTTPS. `SameSite=Lax` restricts cross-site cookie sending while allowing cases such as following a normal link to the site. These flags reduce exposure and are used alongside other checks.

Authentication establishes the account identity using the access token and database session. Authorization checks the account's permitted role and relationship to the resource. CSRF protection helps prevent another site from using an already authenticated browser to perform an unwanted action. For protected requests that change data, the guard hashes `X-CSRF-Token` and compares it with the session's stored CSRF hash. Refresh performs its own CSRF check. The separate CSRF cookie is intentionally JavaScript-readable so Swagger can copy its value into that header. Having a CSRF token alone does not authenticate an account.

The global `ValidationPipe` enforces DTO rules at runtime and rejects unexpected properties. Services enforce business rules and ownership; database constraints enforce uniqueness. Swagger's schema documents inputs, while the server enforces them. Adding `role: "Admin"` to traveler registration does not grant that role because the DTO rejects the extra field.

Swagger uses `withCredentials: true` and a request interceptor. Logging in through `/api/auth/login` sets the browser cookies, and the interceptor adds the CSRF header. Login uses application credentials, not Atlas passwords or Stripe keys. There is no need to paste access/refresh tokens into Authorize. `/api/auth/me` confirms the current account and role; lock icons describe endpoint requirements.

Verification example to understand: Log in, inspect `/api/auth/me`, perform a permitted write, and inspect its CSRF header. A controlled missing-CSRF test should fail with 403 on a protected write. Record the actual endpoint and response, without recording credentials.

### Provider permissions

Source: [manageProvider and flight services](../../backend/src/flights/flights.ts), [hotel services](../../backend/src/hotels/hotels.ts), [role guard](../../backend/src/auth/auth.ts) and [moderator creation](../../backend/src/admin/admin.ts).

Question: How are roles different from ownership/assignment? Why cannot moderator A edit provider B?

Answer: A role permits a type of operation. Ownership or assignment limits the specific records on which the account may perform that operation. Two travelers have the same role but cannot manage each other's bookings. Two airline moderators have the same role but manage their respective assigned providers.

The guard checks the endpoint's `@Roles` requirement. The service then loads the actual provider and calls `manageProvider`, which requires both the matching moderator role and a matching `providerId`. That assignment comes from the account loaded from MongoDB. An administrator creates a moderator with one provider assignment and validates the provider type. Changing the target URL does not change the stored assignment.

For a flight, the service loads its actual airline before checking assignment. For a room, it checks the hotel assignment and also that the room belongs to that hotel. Therefore, a moderator assigned to A cannot edit B, even when both providers have the same type. Traveler booking ownership similarly compares the booking's `userId` with the authenticated account's ID.

Verification example to understand: Using synthetic providers A and B, valid credentials/CSRF and a completed temporary-password change, confirm that editing A succeeds and editing B returns the assigned-provider 403 error. Confirm B is unchanged. A generic 403 caused by missing CSRF would not independently demonstrate assignment enforcement.

### Inventory

Source: [inventory.ts](../../backend/src/bookings/inventory.ts), [booking holds](../../backend/src/bookings/bookings.ts), [room-night indexes](../../backend/src/database.ts) and [concurrency tests](../../backend/test/integration/platform.spec.ts).

Question: Demonstrate last-seat contention, all-or-nothing round trips/multiple rooms and half-open stay dates.

Answer: Flight cabins track `capacity`, `held` and `booked`. Available seats are calculated from capacity minus both held and booked seats. `acquireFlights` uses a conditional update that checks the inventory values it read, inside a database transaction. Competing writes cannot both successfully reserve the same final capacity. A conflict is rejected or the transaction is retried against current state.

`holdFlight` reserves every selected segment and creates the booking using one transaction session. If either direction of a round trip is unavailable, there is no partial successful reservation. Hotel inventory uses one `RoomNight` document for each selected room and occupied date. The unique `(roomId, date)` index prevents duplicate allocations; the transaction ensures that every selected room-night and the booking are acquired together.

Hotel dates are half-open: `[checkIn, checkOut)`. For example, a stay from 20 to 23 December consumes the nights of 20, 21 and 22 December. Another stay may begin on 23 December. It does not overlap the first stay's room-nights.

Ten-minute holds are checked using timestamps and a worker. Correctness does not depend on immediate TTL deletion. Expiry changes state and releases inventory together, with guards that prevent repeated release.

Verification examples to understand: The automated scenarios send two simultaneous requests for the last seat and expect one 201 and one 409, with exactly one seat held. Other scenarios make the return flight unavailable or one requested hotel room unavailable and check that no partial allocation remains. The adjacent-stays scenario expects both reservations to succeed. Swagger can demonstrate sequential availability and adjacency; actual concurrency needs parallel requests or the integration test, not two sequential clicks. Do not change dates or completion states directly in the application database to simulate these tests; use the disposable test environment.

### Bookings

Source: [bookings.ts](../../backend/src/bookings/bookings.ts), [inventory lifecycle](../../backend/src/bookings/inventory.ts) and [refund tier selection](../../backend/src/common.ts).

Question: Explain snapshots, lifecycle, cancellation deadlines, refund tiers and completion.

Answer: A hold stores a snapshot of the selected travel details, passengers or guests, prices and applicable policies. It also stores the calculated amount and currency. Later provider price/policy edits do not silently replace the terms recorded for that booking.

The main lifecycle is `Pending Payment -> Confirmed -> Completed`, with `Pending Payment -> Expired` at the original hold deadline and eligible `Confirmed -> Cancelled` transitions. Verified payment processing creates confirmation and a booking reference. A client request cannot simply declare the booking paid or completed.

Provider flight cancellation invalidates unpaid holds and releases their inventory once. Such a booking remains `Pending Payment` until its original deadline, with `holdInvalidatedAt` recording that payment is blocked. It then becomes `Expired`. A successful payment that cannot be fulfilled is compensated rather than recreating released inventory. This is the GEN-11 correction recorded in the release audit.

Traveler cancellation requires an owned, Confirmed booking before the permitted deadline. Flight calculations use whole 24-hour periods before departure; hotel calculations use hotel-local calendar dates and prohibit cancellation on/after the check-in date. `refundPercent` selects the highest snapshotted threshold that the remaining days satisfy, or zero when none applies. Cancellation releases the reservation and records the eligible refund. Provider flight cancellation gives confirmed affected bookings a full refund. Provider deactivation is a separate operation and preserves existing confirmed bookings.

Completion is derived from travel/stay timing. Flight bookings complete after their recorded end. Hotel completion also requires the hotel-local check-out date to have passed; the current code does not mark a stay Completed at the beginning of check-out day. Completion enables eligible hotel reviews. Repeated cancellation is guarded to avoid duplicate inventory release and refunds.

Verification example to understand: Hold a test booking, inspect its snapshots and policy quote, change a provider's current price, and confirm the held amount is unchanged. Record the actual cancellation quote, cancellation status and eventual refund status separately.

### Payments

Source: [payments.ts](../../backend/src/payments/payments.ts), [flight changes](../../backend/src/bookings/bookings.ts) and [refund allocation](../../backend/src/bookings/inventory.ts).

Question: Why not trust client success? Explain raw-body signatures, amount/currency checks, replay handling, compensation and repeated changes.

Answer: Browser responses can be changed or forged, so booking confirmation is based on Stripe evidence verified by the backend. The public webhook endpoint passes the unchanged raw body and `stripe-signature` header to Stripe's signature verifier using the private signing secret. It rejects invalid signatures and live-mode events in this test-mode application. Public here means that it does not use a travel-account login; the Stripe signature is still required.

For a success event, the service checks successful status, the expected amount in minor units, currency, booking association and Stripe PaymentIntent identity. It checks that the hold can still be fulfilled. Event processing, local payment state, inventory conversion, booking confirmation and notifications are coordinated in a database transaction.

The unique Stripe event ID and `processedAt` prevent replaying a processed event from applying the effects again. Payment status and booking state also guard against different events repeating the same logical success. Stable Stripe idempotency keys are used for external payment/refund operations. If payment succeeds after expiry or invalidation, the service records a compensating full refund and keeps released inventory unavailable to that old booking.

Flight changes reserve replacement inventory while the original confirmed booking remains valid. A higher fare requires accepted replacement policies and a successful fare-difference payment; a cheaper fare records the applicable refund. Revision checks prevent a stale change from overwriting a newer booking state. Only one pending change per booking is allowed. Committing a change preserves the booking reference, releases old inventory and removes old seat assignments. Later changes use the current booking revision and amount. Refund allocation accounts for earlier successful payments/refunds rather than issuing unlimited repeated refunds.

Verification example to understand: Use Stripe sandbox PaymentIntents and actual signed webhook forwarding. Record confirmation and cancellation/refund results from both the application and Stripe. The backend must not receive raw card details. Existing fixture-based success events are useful automated evidence but are not a substitute for this external-service check.

### Background jobs

Source: [jobs.ts](../../backend/src/jobs.ts), [outbox/notification helpers](../../backend/src/ops.ts) and [Stripe recovery work](../../backend/src/payments/payments.ts).

Question: Why keep external calls outside transactions? Explain operation keys, leases, retry and crash recovery.

Answer: MongoDB cannot roll back a Stripe API call or an email already sent. Network delays would also hold a database transaction open unnecessarily. The application records durable external work in `Outbox`, alongside related state when a transaction is supplied, and processes the network operation afterward.

An operation key identifies the logical work. `enqueue` uses an upsert plus a unique key, and Stripe requests use stable idempotency keys. The worker atomically claims due work or expired leases, marks it Running, increments attempts and assigns a two-minute lease. Successful work is marked Done. Failed work returns to Pending with capped exponential backoff. A crashed worker's expired lease can be reclaimed after restart because the work is stored in MongoDB rather than only in memory.

The worker normally checks expiry, completion and queued work every ten seconds. Exchange-rate checks run hourly and refresh when the last successful fetch is at least a day old. Database guards still matter when multiple workers or retried operations compete. A lease covers a time period rather than guaranteeing that an external effect happens exactly once. Stripe idempotency/reconciliation protects repeated financial requests; email could be delivered twice if a crash occurs after delivery but before the job is marked Done. A terminal Stripe refund failure remains visible for operator reconciliation.

Verification example to understand: Inspect a test outbox record's state, attempts and retry time during a controlled service failure, then restore the service and observe recovery. Keep actual external service outages and manual test results separate from historical fixture evidence.

### Itineraries

Source: [itineraries.ts](../../backend/src/itineraries/itineraries.ts) and [exchange-rate cache](../../backend/src/ops.ts).

Question: Explain derived dates, ordering/groups, budgets, FX fallback and independent clones without private booking IDs.

Answer: Days are an ordered array owned by the itinerary, limited to 60. A displayed day number and date are calculated from its array position and the itinerary start date. Reordering must include each day exactly once. Consecutive days in the same city form a city group; revisiting that city later produces another group. Deletion removes that day's dependent transport entries and booking links. These derived values avoid maintaining separate editable dates that could become inconsistent.

The budget combines manual category entries, activity costs, intercity transport and each linked eligible booking once. A booking can be linked only once to that itinerary and must belong to its owner. Category, day and city-group totals are calculated from the same expense entries. The system cannot infer that two separately entered manual expenses describe the same real-world purchase, so the student should avoid manually duplicating an automatically linked cost.

Currency conversion uses cached USD-based rates: divide the source amount by its source rate, then multiply by the preferred-currency rate. The response exposes the rate date/fetch time. Failed refresh does not overwrite the last successful cache. If conversion needs rates and there is no usable cache/rate, it reports unavailability rather than silently using zero. An itinerary can still be returned with an unavailable-budget explanation for a missing cache.

Only public itineraries can be cloned. A clone has a new owner and fresh day/activity/budget IDs, starts Private, and retains attribution to its source author. Public responses remove private booking links. Cloning turns linked booking costs into independent numeric expenses rather than copying another person's private booking IDs. New media records can reference the same immutable files; editing/deleting the original itinerary does not edit the clone's documents. Flight/hotel itinerary searches reuse the existing search services.

Verification example to understand: Reorder/delete days, revisit a city, compare calculated totals, clone a public itinerary and edit the original. Check privacy and the clone's lack of private booking references. Record the actual dates, totals and access outcomes observed.

### Community

Source: [community.ts](../../backend/src/community/community.ts), [author labels](../../backend/src/ops.ts), [itinerary access](../../backend/src/itineraries/itineraries.ts) and [unique interaction indexes](../../backend/src/database.ts).

Question: Explain draft/privacy, one like/report/review rules, review eligibility and deactivated-author labels.

Answer: A public post must be Published, visible and written by an account that is not deactivated. The post owner and administrator can inspect drafts/hidden posts through the relevant access rules. Editing requires ownership. Itinerary access separately requires public visibility or ownership; administrator moderation does not automatically grant access to every private itinerary.

Likes are unique per `(postId, userId)` and can be removed. Reports are unique per `(userId, contentType, contentId)`. Reviews are unique per hotel booking, regardless of its room count. Review creation verifies an owned Completed hotel reservation; a future or cancelled reservation is not eligible. Review changes and moderation recalculate the hotel's rating. Only the assigned hotel moderator may reply.

Comments/reviews from deactivated authors use the shared `Deleted user` label and suppress their public author ID. Deactivation also removes the author's posts/itineraries from public discovery. Suspension is separate and does not automatically apply deactivation visibility rules. Public blog search ranks using likes plus visible comments, then recency. Attached itinerary access is checked when the post is read.

Verification example to understand: Attempt another user's draft, a duplicate like/report, an ineligible review and a reply from the wrong hotel moderator. Use the controlled completed-stay test fixture for historical review eligibility; there is no public API for forging completion.

### Administration

Source: [admin.ts](../../backend/src/admin/admin.ts), [account deactivation](../../backend/src/auth/auth.ts), [content removal](../../backend/src/community/community.ts) and [audit helper](../../backend/src/ops.ts).

Question: Explain separate account/provider status, reports, hiding/deletion and audit records.

Answer: Account status controls a person's ability to authenticate and act. Suspension blocks authenticated access and revokes sessions; reactivation restores an eligible account. Self-deactivation has its own rules, including the upcoming-confirmed-booking restriction and public-content behavior. Provider status is a separate `active` flag on an airline/hotel. Deactivating a provider blocks new eligible booking/confirmation flows and notifies affected users/moderators, while preserving existing confirmed bookings. It does not itself suspend the assigned moderator or cancel all reservations.

An administrator can dismiss a report or hide/delete its target. A report can be resolved only while Open and records the resolving administrator. Hiding keeps the record while restricting visibility according to the content's access rules, including owner/admin exceptions and underlying privacy. Deletion removes the target document and relevant dependent data, such as a deleted post's comments/likes or a review's rating contribution.

Audit records contain the acting administrator, action, target, time and applicable details. Account/provider status changes and report resolution include their associated audit records in their transactions. Audit logs provide a review trail; the application does not claim cryptographic tamper-proof logging. Administrative routes have their own role checks rather than allowing all users to change status or resolve reports.

Verification example to understand: As administrator, resolve a synthetic report, inspect the changed visibility and audit record, and verify that a traveler cannot perform the same administrative operation. Compare account suspension with provider deactivation without using real customer records.

### Media

Source: [media.ts](../../backend/src/media/media.ts).

Question: Why not trust the file extension? Explain decoding/size/count checks and private-parent access.

Answer: A filename or declared MIME type can be changed without changing the file's bytes. `validateImage` therefore checks the PNG/JPEG signature, the matching declared MIME type and successful image decoding. Corrupt files, empty files, unsupported formats and files larger than five MiB are rejected. Safe decoding limits include a 20-megapixel limit and a bounded JPEG decoding memory setting; PNG decoding checks its CRC.

The limits are five images per post, activity or hotel, and one airline logo. Upload handling checks the parent owner/provider assignment, uses a generated UUID filename and rechecks the parent/count while updating its media references in a transaction. If that database operation fails, the newly written file is removed.

Files are served through `/api/media/:id`, which checks the current parent visibility and uses `private, no-store` caching. The storage folder is not exposed as an unrestricted static directory. Knowing an image ID does not bypass a private itinerary or hidden-post access rule. Removing media checks that it belongs to the requested parent. Some immutable files can be shared by clone media records, so removal retains shared storage files for future safe garbage collection rather than deleting every referenced file immediately.

Verification example to understand: Upload a valid image, a renamed non-image and a sixth image; then try another user's private activity image. Record actual responses without including private content in the review evidence.

### Seeds

Source: [seed.ts](../../backend/src/seed.ts) and [official reference records](../../backend/data/reference.json).

Question: Explain official identifiers, idempotency, admin seeding and demo accounts versus contributors.

Answer: Reference seeding reads the supplied cached official data and preserves identifiers such as airport IATA codes, city IDs, country codes and attraction IDs. It uses those identifiers as upsert keys. Repeating reference seeding updates the matching records instead of adding duplicates. Supported currencies are derived from country records.

The administrator is seeded from private local configuration, with the password stored as a salted hash. There is no public administrator registration endpoint. `$setOnInsert` creates the administrator only when it is absent; rerunning the seed or editing `ADMIN_PASSWORD` does not replace the password on an existing account. Existing administrator password changes must use the appropriate authenticated flow.

Optional demo seeding is separate from official reference seeding, creates synthetic travel providers/accounts and is forbidden when `NODE_ENV=production`. The demo accounts use the configured seed password; moderators require a password change. They are application test actors, not additional students, developers or Git contributors. The project has one human student and disclosed AI assistance. Demo flight dates are relative to the run date, so a later demo run can create new dated examples even though official reference seeding remains idempotent.

Verification example to understand: Run official/reference seeding twice in a disposable environment and compare counts and identifiers. Inspect the administrator creation behavior without printing any private configuration. Do not assume rerunning the seed rotates an existing password.

### Integration tests and evidence

Source: [platform.spec.ts](../../backend/test/integration/platform.spec.ts), [API coverage observer](../../backend/test/api-coverage.ts), [API report](API_TEST_REPORT.md), [Stripe verification](STRIPE_VERIFICATION_REPORT.md) and [bonus verification](BONUS_VERIFICATION.md).

Question: What uses real MongoDB? What uses Stripe/SMTP fixtures? What requires account-backed evidence?

Answer: The HTTP integration suite starts an actual disposable MongoDB replica set using `MongoMemoryReplSet`, not a mocked database. Supertest sends requests through the Nest application, so schemas/indexes, transactions, guards, DTO validation and services execute together. The suite uses isolated data and must not be pointed at the application Atlas database for destructive scenarios.

Repeatable payment/email edge cases use fixture adapters and synthetic test events. For example, `markPaid` exercises local processing with a constructed event; that alone does not prove Stripe delivered a signed webhook. Other tests exercise signature validation and failure cases with controlled test inputs. Synthetic users, providers and completed hotel stays are fixtures, not real customers or historical travel.

Separate live verification records establish actual Atlas connectivity, Stripe sandbox payments/refunds and signed-event delivery, FX retrieval and SMTP delivery to the local Mailpit inbox. The 19 November engineering evidence records 57 passing tests and successful workflows for all 148 API operations, plus additional role/CSRF checks and live bonus verification. Those are recorded assistant-executed results, not a claim that the student reran them today. SMTP delivery to a local inbox is not proof of delivery to a personal/internet mailbox. Successful operation coverage also does not exhaust every possible input or race.

Verification example to understand: Run the documented typecheck, lint, test and build commands; record their actual outputs and reviewed version. Follow the role-by-role Swagger walkthrough and compare the separate external-service receipts. Use private configuration and omit passwords, cookies, raw tokens, card details and secret keys from recorded evidence. Any failed or unperformed check should remain visible.

## Recorded verification results

The fresh checks below were executed by the assistant/automation on **20 November 2026** from a clean extraction of the exact submission package. They are not attributed to personal student execution. See the [fresh check record](evidence/pre-submission-check-2026-11-20.json).

| Check | Recorded result |
| --- | --- |
| Fresh `npm ci` | 606 packages installed; zero reported vulnerabilities |
| Type checking and lint | Passed |
| Unit/HTTP tests | 57 passed, 0 failed, 0 skipped |
| Successful API workflows | 148/148 |
| Access matrices | 120 anonymous, 100 wrong-role and 86 missing-CSRF checks passed |
| Build | Passed |
| Compiled HTTPS/actual FX | Five checks passed |
| Primary HTTPS/Swagger/OpenAPI | Eleven certificate-verified requests passed |
| Actual Atlas authentication/read-only transaction | Passed on direct and combined retry; initial failed probe retained |
| Actual Stripe sandbox authentication | Passed |
| Local SMTP connection and inbox | Passed |

The full actual payment/refund/ten-minute-expiry and all 11 bonus checks retain their **19 November** evidence. They were not relabeled as new runs. SMTP delivery used the local Mailpit inbox; personal/internet mailbox delivery was not established. Some rare financial/restart permutations retain controlled fixture evidence.

The recorded automated concurrency scenarios demonstrate one successful final-seat hold and one conflict, no outbound allocation when a round trip fails, no partial multi-room allocation, and successful adjacent stays. The [integration tests](../../backend/test/integration/platform.spec.ts) contain the assertions; the [fresh route coverage](evidence/submission-route-coverage-2026-11-20.json) records actual responses. These examples explain verified behavior without inventing a student's manual demonstration.

## Findings, corrections and limits

| Area | Recorded observation and outcome |
| --- | --- |
| Booking lifecycle / GEN-11 | Early expiry on provider-invalidated unpaid holds was corrected: release inventory once, block payment and enter Expired only at the original deadline. Regression checks passed. |
| Recovery email / ACC-07 | Token-only recovery was replaced with a working single-use HTTPS reset link/form. Automated checks and actual local SMTP delivery passed with their recorded dates. |
| Provider and ownership boundaries | Role plus actual account assignment/ownership checks protect specific records. Targeted additional AI audits found no concrete blocker. |
| Review evidence | The student reports checking Swagger and approved the explanations/documentation; detailed personal endpoint results were not supplied. |
| Credentials | Rotation of previously shared Atlas/application administrator passwords is still unconfirmed. Connectivity does not prove rotation. |
| Submission version | The implementation is in the verified ZIP/current feature branch. `main` remains the initial specification baseline; release branches are not merged. |
| Scope | Frontend-only GEN-14 through GEN-17 belong to Milestone 2; the backend supports their relevant APIs. No production deployment or exhaustive security/load certification is claimed. |

## Student response supported by the actual statements

The following is a paraphrase of the student's confirmed statements, not a fabricated signature or test transcript:

> I am the sole human student working on the project. I personally checked Swagger. I approve including the supplied written explanations and completing the documentation/package. The implementation and these explanations received AI assistance. The automated and assistant-executed results are documented separately from my personal Swagger use.

Approval was actually received on **20 November 2026**, with the scope recorded in [the approval/test record](STUDENT_APPROVAL_AND_TEST_RECORD.md). The precise personal Swagger date/version, roles, endpoints and observed response codes were not supplied. There is no invented claim that the student personally reran every test or reviewed every source line.

## Review conclusion

**The written implementation answers are complete. Engineering verification passed, and the targeted AI audits found no concrete submission-blocking code defect.** This is an AI-assisted written explanation and evidence summary, not proof of independent human understanding or instructor acceptance. The student remains responsible for the submitted result and explaining it during evaluation.

Only actual personal details remain to be added if required: formal student name/ID and the real observations from the student's Swagger session. Previously shared credentials still need private rotation/confirmation. Submit the exact verified package/current implementation branch through the course portal; no portal submission is claimed here. See [submission readiness](SUBMISSION_READINESS.md) for the private rotation and startup steps.
