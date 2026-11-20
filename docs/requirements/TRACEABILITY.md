# Requirements traceability

All 115 workbook requirements are preserved. Endpoint coverage is derived from Swagger summaries; source mappings cover cross-cutting rules without dedicated endpoints.

**Implemented does not mean externally verified or independently human-reviewed.** The JSON register preserves complete source text, dependencies, evidence locations, and limitations. Four mandatory visual/UI requirements remain in Milestone 2. Other UI portions are identified in the notes.

## Mandatory

| ID | Module | Endpoint coverage | Status / notes |
| --- | --- | --- | --- |
| ACC-01 | Accounts & Admin | `POST /api/auth/register` | Consent/password validation and unique-email index; inline UI belongs to M2. |
| ACC-04 | Accounts & Admin | `POST /api/auth/login`<br>`GET /api/auth/me` | Role landing path returned by API; actual dashboard pages belong to M2. |
| ACC-05 | Accounts & Admin | `POST /api/auth/login` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-06 | Accounts & Admin | `POST /api/auth/refresh`<br>`POST /api/auth/logout` | Server inactivity, refresh revocation and cookie clearing are implemented. |
| ACC-07a | Accounts & Admin | `POST /api/admin/users/{id}/reset-password` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-08 | Accounts & Admin | `PATCH /api/auth/change-password` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-09 | Accounts & Admin | `PATCH /api/users/me` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-10 | Accounts & Admin | Shared service, seed, or frontend contract | Restricted APIs return 401. Login redirect and return-to-action navigation belong to M2. |
| ACC-11 | Accounts & Admin | `GET /api/users/me` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-12 | Accounts & Admin | `DELETE /api/users/me` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-13 | Accounts & Admin | `POST /api/admin/moderators` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-14 | Accounts & Admin | `GET /api/admin/accounts` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-15 | Accounts & Admin | `PATCH /api/admin/accounts/{id}/suspend`<br>`PATCH /api/admin/accounts/{id}/reactivate`<br>`PATCH /api/admin/providers/{type}/{id}/deactivate`<br>`PATCH /api/admin/providers/{type}/{id}/reactivate` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-16 | Accounts & Admin | `PATCH /api/admin/accounts/{id}/suspend`<br>`PATCH /api/admin/accounts/{id}/reactivate` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-17 | Accounts & Admin | `GET /api/admin/bookings` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-01 | Flights | `POST /api/airlines`<br>`GET /api/airlines/{id}`<br>`PATCH /api/airlines/{id}`<br>`POST /api/airlines/{id}/logo`<br>`DELETE /api/airlines/{id}/logo/{imageId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-02 | Flights | `GET /api/airports` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-03 | Flights | `POST /api/flights` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-04 | Flights | `POST /api/flights/{id}/cabins`<br>`PATCH /api/flights/{id}/cabins/{cabinId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-05 | Flights | `PATCH /api/flights/{id}`<br>`PATCH /api/flights/{id}/cabins/{cabinId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-06 | Flights | `POST /api/flights/{id}/cancel` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-08 | Flights | `PUT /api/airlines/{id}/baggage-policy` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-09 | Flights | `PUT /api/airlines/{id}/cancellation-policy` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-11 | Flights | `GET /api/flights/search` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-12 | Flights | `GET /api/flights/search` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-15 | Flights | `GET /api/flights/search` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-17 | Flights | `GET /api/flights/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-19 | Flights | `POST /api/flight-bookings` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-21 | Flights | `POST /api/flight-bookings` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-22 | Flights | `POST /api/flight-bookings/hold` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-23 | Flights | `GET /api/flight-bookings/{id}/e-ticket` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-25 | Flights | `GET /api/flight-bookings`<br>`GET /api/flight-bookings/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-26 | Flights | `GET /api/flight-bookings/{id}/cancellation-quote`<br>`POST /api/flight-bookings/{id}/cancel` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-29 | Flights | `GET /api/flights/{id}/bookings`<br>`GET /api/flights/{id}/passengers/export` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-01 | Hotels | `POST /api/hotels`<br>`PATCH /api/hotels/{id}`<br>`POST /api/hotels/{id}/images`<br>`DELETE /api/hotels/{id}/images/{imageId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-02 | Hotels | `GET /api/hotels/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-03 | Hotels | `POST /api/hotels/{id}/rooms` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-04 | Hotels | `POST /api/hotels/{id}/rooms/{roomId}/availability` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-05 | Hotels | `PATCH /api/hotels/{id}/rooms/{roomId}`<br>`PATCH /api/hotels/{id}/rooms/{roomId}/availability` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-06 | Hotels | `PATCH /api/hotels/{id}/rooms/{roomId}`<br>`DELETE /api/hotels/{id}/rooms/{roomId}`<br>`PATCH /api/hotels/{id}/rooms/{roomId}/availability` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-08 | Hotels | `GET /api/hotels/{id}/availability` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-09 | Hotels | `PUT /api/hotels/{id}/policies` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-10 | Hotels | `PUT /api/hotels/{id}/policies` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-11 | Hotels | `GET /api/hotels/search` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-12 | Hotels | `GET /api/hotels/search` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-15 | Hotels | `GET /api/hotels/{id}/rooms/available` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-16 | Hotels | `POST /api/hotel-bookings` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-17 | Hotels | Shared service, seed, or frontend contract | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-18 | Hotels | `POST /api/hotel-bookings` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-20 | Hotels | `GET /api/hotel-bookings`<br>`GET /api/hotel-bookings/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-21 | Hotels | `GET /api/hotel-bookings/{id}/cancellation-quote`<br>`POST /api/hotel-bookings/{id}/cancel` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-22 | Hotels | `GET /api/hotels/{id}/reservations` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-23 | Hotels | `POST /api/hotel-bookings/{id}/review`<br>`PATCH /api/reviews/{id}`<br>`DELETE /api/reviews/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-24 | Hotels | `GET /api/hotels/{id}/reviews` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| PAY-01 | Payments & Policies | `POST /api/payments`<br>`POST /api/payments/webhook`<br>`POST /api/payments/{id}/retry`<br>`GET /api/payments/{id}` | Signed HTTP webhook and adapter workflows pass locally; a real Stripe test account is not configured. |
| PAY-02 | Payments & Policies | `GET /api/bookings/{type}/{id}/policies`<br>`POST /api/bookings/{type}/{id}/accept-policies`<br>`GET /api/flight-changes/{id}/policies`<br>`POST /api/flight-changes/{id}/accept-policies` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| PAY-03 | Payments & Policies | `GET /api/refunds/{id}` | Refund records, compensation, idempotency and retry tested with adapter fixtures; real Stripe refund unverified. |
| ITN-01 | Itineraries | `POST /api/itineraries`<br>`PATCH /api/itineraries/{id}`<br>`DELETE /api/itineraries/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-03 | Itineraries | `GET /api/itineraries`<br>`GET /api/itineraries/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-05 | Itineraries | `POST /api/itineraries/{id}/days`<br>`PATCH /api/itineraries/{id}/days/{dayId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-07 | Itineraries | `DELETE /api/itineraries/{id}/days/{dayId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-08 | Itineraries | `PATCH /api/itineraries/{id}/days/reorder` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-09 | Itineraries | `GET /api/itineraries/{id}/budget-summary` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-10 | Itineraries | `POST /api/itineraries/{id}/days/{dayId}/activities`<br>`PATCH /api/activities/{id}`<br>`DELETE /api/activities/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-12 | Itineraries | `POST /api/activities/{id}/images`<br>`DELETE /api/activities/{id}/images/{imageId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-14 | Itineraries | `POST /api/itineraries/{id}/days/{dayId}/budgets`<br>`GET /api/itineraries/{id}/budget-summary`<br>`PATCH /api/budgets/{id}`<br>`DELETE /api/budgets/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-16 | Itineraries | `POST /api/itineraries/{id}/transport-costs`<br>`PATCH /api/transport-costs/{id}`<br>`DELETE /api/transport-costs/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-18 | Itineraries | `GET /api/itineraries/{id}/budget-summary`<br>`POST /api/admin/exchange-rates/refresh`<br>`GET /api/exchange-rates` | Actual FXRatesAPI fetch/cache verified separately; outage fallback tested with cached fixture. |
| ITN-20 | Itineraries | `GET /api/itineraries/public/search`<br>`PATCH /api/itineraries/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-21 | Itineraries | `GET /api/itineraries/public/search`<br>`GET /api/itineraries/public/{id}`<br>`POST /api/itineraries/{id}/clone` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-25 | Itineraries | `GET /api/itineraries/{id}/hotels` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-26 | Itineraries | `GET /api/itineraries/{id}/flights` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-01 | Blog | `POST /api/posts` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-02 | Blog | `GET /api/posts`<br>`GET /api/posts/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-03 | Blog | `GET /api/posts/mine` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-04 | Blog | `PATCH /api/posts/{id}`<br>`DELETE /api/posts/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-05 | Blog | `POST /api/posts/{id}/comments` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-06 | Blog | `POST /api/posts/{id}/like`<br>`DELETE /api/posts/{id}/like` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-07 | Blog | `PATCH /api/comments/{id}`<br>`DELETE /api/comments/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-08 | Blog | `POST /api/posts`<br>`PATCH /api/posts/{id}`<br>`GET /api/tags/{tag}/posts` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-09 | Blog | `GET /api/posts` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-10 | Blog | `POST /api/posts/{id}/images`<br>`DELETE /api/posts/{id}/images/{imageId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-12 | Blog | `GET /api/authors/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| GEN-01 | Cross-cutting | `GET /api/notifications`<br>`PATCH /api/notifications/{id}/read` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| GEN-02 | Cross-cutting | Shared service, seed, or frontend contract | Field-specific backend errors implemented; inline rendering belongs to M2. |
| GEN-03 | Cross-cutting | Shared service, seed, or frontend contract | Destructive endpoints require explicit confirmation where applicable; confirmation dialogs belong to M2. |
| GEN-04 | Cross-cutting | Shared service, seed, or frontend contract | Empty search/list results are explicit; friendly visual states belong to M2. |
| GEN-05 | Cross-cutting | Shared service, seed, or frontend contract | Paginated collection endpoints use page size 10. Nested document structures and exports are not collection pages. |
| GEN-06 | Cross-cutting | `GET /api/flights/{id}` | Flight detail/search include local timestamps; tickets include both airport zones. |
| GEN-07 | Cross-cutting | `GET /api/admin/audit-logs` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| GEN-08 | Cross-cutting | `GET /api/media/{id}`<br>`POST /api/posts/{id}/images`<br>`POST /api/activities/{id}/images`<br>`POST /api/hotels/{id}/images`<br>`DELETE /api/hotels/{id}/images/{imageId}`<br>`POST /api/airlines/{id}/logo`<br>`DELETE /api/airlines/{id}/logo/{imageId}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| GEN-09 | Cross-cutting | `POST /api/reports` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| GEN-10 | Cross-cutting | `GET /api/admin/reports`<br>`PATCH /api/admin/reports/{id}`<br>`PATCH /api/admin/content/{type}/{id}`<br>`DELETE /api/admin/content/{type}/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| GEN-11 | Cross-cutting | Shared service, seed, or frontend contract | Booking transitions and scheduled completion/expiry implemented. Invalidated holds release inventory once and remain Pending Payment until the original timeout; payment is blocked and late success refunded. GEN-11 regression passes. |
| FLT-30 | Flights | Shared service, seed, or frontend contract | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ACC-18 | Accounts & Admin | Shared service, seed, or frontend contract | Administrator is seeded; no admin self-registration route exists. |
| PAY-04 | Payments & Policies | Shared service, seed, or frontend contract | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| GEN-12 | Cross-cutting | `GET /api/countries`<br>`GET /api/cities`<br>`GET /api/attractions`<br>`GET /api/currencies` | Official countries/cities/airports/attractions and derived supported currencies are seeded idempotently. |
| GEN-13 | Cross-cutting | Shared service, seed, or frontend contract | Global DTO validation, service rules, ownership checks and salted scrypt password hashing. |
| ACC-19 | Cross-cutting | `POST /api/auth/refresh`<br>`GET /api/auth/me` | httpOnly/Secure/SameSite cookies, refresh rotation and /auth/me; frontend storage behavior needs M2 inspection. |
| GEN-14 | Cross-cutting | Shared service, seed, or frontend contract | Milestone 2 frontend information architecture; role paths, resource APIs and validation contracts available now. |
| GEN-15 | Cross-cutting | Shared service, seed, or frontend contract | Milestone 2 frontend ease of use and visual workflow evaluation. |
| GEN-16 | Cross-cutting | Shared service, seed, or frontend contract | Milestone 2 responsive/loading/success/error UI; backend errors and operation results available now. |
| GEN-17 | Cross-cutting | Shared service, seed, or frontend contract | Milestone 2 palette, typography, spacing and component consistency. |

## Bonus

| ID | Module | Endpoint coverage | Status / notes |
| --- | --- | --- | --- |
| ACC-02 | Accounts & Admin | `GET /api/auth/verify-email` | Verification gate and single-use links tested; actual inbox delivery unverified. |
| ACC-07 | Accounts & Admin | `POST /api/auth/forgot-password`<br>`GET /api/auth/reset-password`<br>`POST /api/auth/reset-password` | Reset expiry/supersession/single-use implemented; actual inbox delivery unverified. |
| GEN-01-B | Cross-cutting | Shared service, seed, or frontend contract | Email queue/retry and actual SMTP delivery to the local development inbox passed on 19 November; see BONUS_VERIFICATION.md. Personal/internet mailbox delivery was not tested. |
| FLT-27 | Flights | `PATCH /api/flight-bookings/{id}/change-flight`<br>`GET /api/flight-changes/{id}`<br>`GET /api/flight-changes/{id}/policies`<br>`POST /api/flight-changes/{id}/accept-policies`<br>`POST /api/flight-changes/{id}/payment` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| FLT-28 | Flights | `GET /api/flight-bookings/{id}/seats`<br>`PATCH /api/flight-bookings/{id}/seat` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| HTL-26 | Hotels | `POST /api/reviews/{id}/reply` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-27 | Itineraries | `POST /api/itineraries/{id}/bookings` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| ITN-28 | Itineraries | `GET /api/itineraries/{id}/pdf` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BLG-13 | Blog | `PATCH /api/posts/{id}/itinerary` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BON-01 | Accounts & Admin | `GET /api/admin/analytics` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
| BON-02 | Cross-cutting | `POST /api/favourites`<br>`GET /api/favourites`<br>`DELETE /api/favourites/{id}` | Source is implemented. Local tests cover representative module workflows; this row is not a claim of exhaustive requirement acceptance. |
