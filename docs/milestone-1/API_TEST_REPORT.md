# API test report

Checked on 2026-11-14 (Africa/Cairo client date).

56/56 automated tests passed; 0 failed. 147/147 documented operations were exercised; 147 returned a successful HTTP response in a functional workflow.

120 anonymous-access checks, 100 incorrect-role checks, and 86 missing-CSRF checks were performed. The refresh endpoint rejects missing CSRF as 401; other protected writes reject it as 403.

## Test scope

The automated suite uses an isolated, disposable MongoDB 8.2.6 replica set on D:. It does not execute destructive workflows against the Atlas application database. Stripe PaymentIntents/refunds/webhooks and SMTP use fixtures or adapter mocks; these are not proof of real account integration. FX success/outage fixtures test the API contract; the separate HTTPS smoke check exercises the real public FX service.

The VS Code browser was inspected: Swagger rendered and the live Atlas-backed health endpoint returned database=true. The 147 functional operation workflows were executed through HTTP automation, not by clicking every operation in Swagger. Read-only live-service checks are recorded separately in evidence/live-api-readonly.json when available.

A successful workflow for each operation does not establish exhaustive input, ownership, concurrency, or requirement coverage. The suite also tests representative business failures, ownership, privacy, contention, payment races and restart recovery. A separate real Stripe sandbox payment/refund/expiry run passed on 2026-11-15; see evidence/stripe-account-verification.json. Actual SMTP delivery and the sole student's review remain pending.

## Reproduce

From backend, run npm.cmd run test:api. See README for TEST_TMP_DIR and the MongoDB executable prerequisite on this Windows machine. Run npm.cmd run typecheck, npm.cmd run lint and npm.cmd run build separately. The operation-coverage gate fails if a newly documented operation has no successful HTTP workflow.

## Operation evidence

Successful codes and expected access denials are observations from this run. Empty access-check columns indicate that the particular check does not apply in the documented global permissions matrix; ownership and provider checks are exercised in the workflow tests.

| Method | Path | Successful codes | Anonymous | Wrong role | Missing CSRF |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | 201 | - | - | - |
| POST | `/api/auth/login` | 201 | - | - | - |
| POST | `/api/auth/refresh` | 201 | 401 | - | 401 |
| POST | `/api/auth/logout` | 201 | - | - | - |
| GET | `/api/auth/me` | 200 | 401 | - | - |
| PATCH | `/api/auth/change-password` | 200 | 401 | - | 403 |
| POST | `/api/auth/forgot-password` | 201 | - | - | - |
| POST | `/api/auth/reset-password` | 201 | - | - | - |
| GET | `/api/auth/verify-email` | 200 | - | - | - |
| GET | `/api/users/me` | 200 | 401 | - | - |
| PATCH | `/api/users/me` | 200 | 401 | - | 403 |
| DELETE | `/api/users/me` | 200 | 401 | - | 403 |
| POST | `/api/airlines` | 201 | 401 | 403 | 403 |
| GET | `/api/airlines/{id}` | 200 | - | - | - |
| PATCH | `/api/airlines/{id}` | 200 | 401 | 403 | 403 |
| PUT | `/api/airlines/{id}/cancellation-policy` | 200 | 401 | 403 | 403 |
| PUT | `/api/airlines/{id}/baggage-policy` | 200 | 401 | 403 | 403 |
| GET | `/api/flights/search` | 200 | - | - | - |
| POST | `/api/flights` | 201 | 401 | 403 | 403 |
| GET | `/api/flights/{id}` | 200 | - | - | - |
| PATCH | `/api/flights/{id}` | 200 | 401 | 403 | 403 |
| POST | `/api/flights/{id}/cancel` | 201 | 401 | 403 | 403 |
| POST | `/api/flights/{id}/cabins` | 201 | 401 | 403 | 403 |
| PATCH | `/api/flights/{id}/cabins/{cabinId}` | 200 | 401 | 403 | 403 |
| GET | `/api/flights/{id}/bookings` | 200 | 401 | 403 | - |
| GET | `/api/flights/{id}/passengers/export` | 200 | 401 | 403 | - |
| POST | `/api/hotels` | 201 | 401 | 403 | 403 |
| GET | `/api/hotels/search` | 200 | - | - | - |
| GET | `/api/hotels/{id}` | 200 | - | - | - |
| PATCH | `/api/hotels/{id}` | 200 | 401 | 403 | 403 |
| POST | `/api/hotels/{id}/rooms` | 201 | 401 | 403 | 403 |
| PATCH | `/api/hotels/{id}/rooms/{roomId}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/hotels/{id}/rooms/{roomId}` | 200 | 401 | 403 | 403 |
| GET | `/api/hotels/{id}/rooms/available` | 200 | - | - | - |
| POST | `/api/hotels/{id}/rooms/{roomId}/availability` | 201 | 401 | 403 | 403 |
| PATCH | `/api/hotels/{id}/rooms/{roomId}/availability` | 200 | 401 | 403 | 403 |
| GET | `/api/hotels/{id}/availability` | 200 | 401 | 403 | - |
| PUT | `/api/hotels/{id}/policies` | 200 | 401 | 403 | 403 |
| GET | `/api/hotels/{id}/reservations` | 200 | 401 | 403 | - |
| POST | `/api/flight-bookings` | 201 | 401 | 403 | 403 |
| GET | `/api/flight-bookings` | 200 | 401 | 403 | - |
| POST | `/api/flight-bookings/hold` | 201 | 401 | 403 | 403 |
| GET | `/api/flight-bookings/{id}` | 200 | 401 | 403 | - |
| GET | `/api/flight-bookings/{id}/cancellation-quote` | 200 | 401 | 403 | - |
| POST | `/api/flight-bookings/{id}/cancel` | 201 | 401 | 403 | 403 |
| GET | `/api/flight-bookings/{id}/e-ticket` | 200 | 401 | 403 | - |
| PATCH | `/api/flight-bookings/{id}/change-flight` | 200 | 401 | 403 | 403 |
| GET | `/api/flight-bookings/{id}/seats` | 200 | 401 | 403 | - |
| PATCH | `/api/flight-bookings/{id}/seat` | 200 | 401 | 403 | 403 |
| POST | `/api/hotel-bookings` | 201 | 401 | 403 | 403 |
| GET | `/api/hotel-bookings` | 200 | 401 | 403 | - |
| GET | `/api/hotel-bookings/{id}` | 200 | 401 | 403 | - |
| GET | `/api/hotel-bookings/{id}/cancellation-quote` | 200 | 401 | 403 | - |
| POST | `/api/hotel-bookings/{id}/cancel` | 201 | 401 | 403 | 403 |
| GET | `/api/bookings/{type}/{id}/policies` | 200 | 401 | 403 | - |
| POST | `/api/bookings/{type}/{id}/accept-policies` | 201 | 401 | 403 | 403 |
| POST | `/api/payments` | 201 | 401 | 403 | 403 |
| POST | `/api/payments/webhook` | 201 | - | - | - |
| POST | `/api/payments/{id}/retry` | 201 | 401 | 403 | 403 |
| GET | `/api/payments/{id}` | 200 | 401 | 403 | - |
| GET | `/api/refunds/{id}` | 200 | 401 | - | - |
| GET | `/api/flight-changes/{id}` | 200 | 401 | 403 | - |
| GET | `/api/flight-changes/{id}/policies` | 200 | 401 | 403 | - |
| POST | `/api/flight-changes/{id}/accept-policies` | 201 | 401 | 403 | 403 |
| POST | `/api/flight-changes/{id}/payment` | 201 | 401 | 403 | 403 |
| GET | `/api/itineraries/public/search` | 200 | - | - | - |
| GET | `/api/itineraries/public/{id}` | 200 | - | - | - |
| POST | `/api/itineraries` | 201 | 401 | 403 | 403 |
| GET | `/api/itineraries` | 200 | 401 | 403 | - |
| GET | `/api/itineraries/{id}` | 200 | 401 | - | - |
| PATCH | `/api/itineraries/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/itineraries/{id}` | 200 | 401 | 403 | 403 |
| POST | `/api/itineraries/{id}/days` | 201 | 401 | 403 | 403 |
| PATCH | `/api/itineraries/{id}/days/reorder` | 200 | 401 | 403 | 403 |
| PATCH | `/api/itineraries/{id}/days/{dayId}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/itineraries/{id}/days/{dayId}` | 200 | 401 | 403 | 403 |
| POST | `/api/itineraries/{id}/days/{dayId}/activities` | 201 | 401 | 403 | 403 |
| POST | `/api/itineraries/{id}/days/{dayId}/budgets` | 201 | 401 | 403 | 403 |
| POST | `/api/itineraries/{id}/transport-costs` | 201 | 401 | 403 | 403 |
| GET | `/api/itineraries/{id}/budget-summary` | 200 | 401 | - | - |
| POST | `/api/itineraries/{id}/clone` | 201 | 401 | 403 | 403 |
| GET | `/api/itineraries/{id}/hotels` | 200 | 401 | 403 | - |
| GET | `/api/itineraries/{id}/flights` | 200 | 401 | 403 | - |
| POST | `/api/itineraries/{id}/bookings` | 201 | 401 | 403 | 403 |
| GET | `/api/itineraries/{id}/pdf` | 200 | 401 | 403 | - |
| PATCH | `/api/activities/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/activities/{id}` | 200 | 401 | 403 | 403 |
| PATCH | `/api/budgets/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/budgets/{id}` | 200 | 401 | 403 | 403 |
| PATCH | `/api/transport-costs/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/transport-costs/{id}` | 200 | 401 | 403 | 403 |
| GET | `/api/posts/mine` | 200 | 401 | 403 | - |
| GET | `/api/posts` | 200 | - | - | - |
| POST | `/api/posts` | 201 | 401 | 403 | 403 |
| GET | `/api/posts/{id}` | 200 | - | - | - |
| PATCH | `/api/posts/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/posts/{id}` | 200 | 401 | 403 | 403 |
| POST | `/api/posts/{id}/comments` | 201 | 401 | 403 | 403 |
| POST | `/api/posts/{id}/like` | 201 | 401 | 403 | 403 |
| DELETE | `/api/posts/{id}/like` | 200 | 401 | 403 | 403 |
| PATCH | `/api/posts/{id}/itinerary` | 200 | 401 | 403 | 403 |
| PATCH | `/api/comments/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/comments/{id}` | 200 | 401 | 403 | 403 |
| GET | `/api/tags/{tag}/posts` | 200 | - | - | - |
| GET | `/api/authors/{id}` | 200 | - | - | - |
| POST | `/api/hotel-bookings/{id}/review` | 201 | 401 | 403 | 403 |
| PATCH | `/api/reviews/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/reviews/{id}` | 200 | 401 | 403 | 403 |
| GET | `/api/hotels/{id}/reviews` | 200 | - | - | - |
| POST | `/api/reviews/{id}/reply` | 201 | 401 | 403 | 403 |
| POST | `/api/reports` | 201 | 401 | 403 | 403 |
| POST | `/api/admin/moderators` | 201 | 401 | 403 | 403 |
| GET | `/api/admin/accounts` | 200 | 401 | 403 | - |
| POST | `/api/admin/users/{id}/reset-password` | 201 | 401 | 403 | 403 |
| PATCH | `/api/admin/accounts/{id}/suspend` | 200 | 401 | 403 | 403 |
| PATCH | `/api/admin/accounts/{id}/reactivate` | 200 | 401 | 403 | 403 |
| PATCH | `/api/admin/providers/{type}/{id}/deactivate` | 200 | 401 | 403 | 403 |
| PATCH | `/api/admin/providers/{type}/{id}/reactivate` | 200 | 401 | 403 | 403 |
| GET | `/api/admin/bookings` | 200 | 401 | 403 | - |
| GET | `/api/admin/reports` | 200 | 401 | 403 | - |
| PATCH | `/api/admin/reports/{id}` | 200 | 401 | 403 | 403 |
| PATCH | `/api/admin/content/{type}/{id}` | 200 | 401 | 403 | 403 |
| DELETE | `/api/admin/content/{type}/{id}` | 200 | 401 | 403 | 403 |
| GET | `/api/admin/audit-logs` | 200 | 401 | 403 | - |
| GET | `/api/admin/analytics` | 200 | 401 | 403 | - |
| POST | `/api/admin/exchange-rates/refresh` | 201 | 401 | 403 | 403 |
| GET | `/api/airports` | 200 | - | - | - |
| GET | `/api/countries` | 200 | - | - | - |
| GET | `/api/cities` | 200 | - | - | - |
| GET | `/api/attractions` | 200 | - | - | - |
| GET | `/api/currencies` | 200 | - | - | - |
| GET | `/api/health` | 200 | - | - | - |
| GET | `/api/notifications` | 200 | 401 | - | - |
| PATCH | `/api/notifications/{id}/read` | 200 | 401 | - | 403 |
| POST | `/api/favourites` | 201 | 401 | 403 | 403 |
| GET | `/api/favourites` | 200 | 401 | 403 | - |
| DELETE | `/api/favourites/{id}` | 200 | 401 | 403 | 403 |
| GET | `/api/exchange-rates` | 200 | 401 | - | - |
| GET | `/api/media/{id}` | 200 | - | - | - |
| POST | `/api/posts/{id}/images` | 201 | 401 | - | 403 |
| DELETE | `/api/posts/{id}/images/{imageId}` | 200 | 401 | - | 403 |
| POST | `/api/activities/{id}/images` | 201 | 401 | - | 403 |
| DELETE | `/api/activities/{id}/images/{imageId}` | 200 | 401 | - | 403 |
| POST | `/api/hotels/{id}/images` | 201 | 401 | - | 403 |
| DELETE | `/api/hotels/{id}/images/{imageId}` | 200 | 401 | - | 403 |
| POST | `/api/airlines/{id}/logo` | 201 | 401 | - | 403 |
| DELETE | `/api/airlines/{id}/logo/{imageId}` | 200 | 401 | - | 403 |

Source: backend/test/integration/platform.spec.ts and backend/test/unit/rules.spec.ts. Machine-readable results: evidence/api-test-results.json and evidence/api-route-coverage.json.
