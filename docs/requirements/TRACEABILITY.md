# Requirements traceability

The workbook defines 104 mandatory requirements and 11 bonuses. The generator compares the full register with the workbook before producing this index. [Original workbook](../../Objectives/Final_%20SP1_Reviewed_Requirements.xlsx)

The 2026-11-25 acceptance run recorded 64/64 backend tests, 17 passing Edge browser tests and 151/151 documented API operations with a successful response. The suite exercises representative scenarios. Independent usability review, visual judgment and student sign-off remain open. [Measured results](../milestone-2/evidence/acceptance-2026-11-25.json) · [Review scope](../milestone-2/ACCEPTANCE.md)

The JSON and CSV include source files and relevant test suites for each requirement. API mappings come from the exported Swagger summaries. [Detailed JSON](traceability.json) · [Detailed CSV](traceability.csv)

## Mandatory

| ID | Module | Mapped API operations | Evidence scope |
| --- | --- | --- | --- |
| ACC-01 | Accounts & Admin | `POST /api/auth/register` | Registration validates consent, password and email. Browser coverage checks inline errors. |
| ACC-04 | Accounts & Admin | `POST /api/auth/login`<br>`GET /api/auth/me` | Login selects the workspace for the authenticated role. |
| ACC-05 | Accounts & Admin | `POST /api/auth/login` | Representative account, provider and audit workflows are covered. |
| ACC-06 | Accounts & Admin | `POST /api/auth/refresh`<br>`POST /api/auth/logout` | Representative account, provider and audit workflows are covered. |
| ACC-07a | Accounts & Admin | `POST /api/admin/users/{id}/reset-password` | Representative account, provider and audit workflows are covered. |
| ACC-08 | Accounts & Admin | `PATCH /api/auth/change-password` | Representative account, provider and audit workflows are covered. |
| ACC-09 | Accounts & Admin | `PATCH /api/users/me` | Representative account, provider and audit workflows are covered. |
| ACC-10 | Accounts & Admin | Shared rule or UI workflow | Login restores the protected destination. Browser tests cover guest flight and hotel handoffs and a forced password change. |
| ACC-11 | Accounts & Admin | `GET /api/users/me` | Representative account, provider and audit workflows are covered. |
| ACC-12 | Accounts & Admin | `DELETE /api/users/me` | Representative account, provider and audit workflows are covered. |
| ACC-13 | Accounts & Admin | `POST /api/admin/moderators`<br>`GET /api/admin/providers` | Representative account, provider and audit workflows are covered. |
| ACC-14 | Accounts & Admin | `GET /api/admin/accounts` | Representative account, provider and audit workflows are covered. |
| ACC-15 | Accounts & Admin | `GET /api/admin/providers`<br>`PATCH /api/admin/accounts/{id}/suspend`<br>`PATCH /api/admin/accounts/{id}/reactivate`<br>`PATCH /api/admin/providers/{type}/{id}/deactivate`<br>`PATCH /api/admin/providers/{type}/{id}/reactivate` | Representative account, provider and audit workflows are covered. |
| ACC-16 | Accounts & Admin | `PATCH /api/admin/accounts/{id}/suspend`<br>`PATCH /api/admin/accounts/{id}/reactivate` | Representative account, provider and audit workflows are covered. |
| ACC-17 | Accounts & Admin | `GET /api/admin/bookings` | Representative account, provider and audit workflows are covered. |
| FLT-01 | Flights | `POST /api/airlines`<br>`GET /api/airlines/{id}`<br>`PATCH /api/airlines/{id}`<br>`POST /api/airlines/{id}/logo`<br>`DELETE /api/airlines/{id}/logo/{imageId}` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-02 | Flights | `GET /api/airports` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-03 | Flights | `GET /api/airlines/{id}/flights`<br>`POST /api/flights` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-04 | Flights | `POST /api/flights/{id}/cabins`<br>`PATCH /api/flights/{id}/cabins/{cabinId}` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-05 | Flights | `GET /api/airlines/{id}/flights`<br>`PATCH /api/flights/{id}`<br>`PATCH /api/flights/{id}/cabins/{cabinId}` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-06 | Flights | `POST /api/flights/{id}/cancel` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-08 | Flights | `PUT /api/airlines/{id}/baggage-policy` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-09 | Flights | `PUT /api/airlines/{id}/cancellation-policy` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-11 | Flights | `GET /api/flights/search` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-12 | Flights | `GET /api/flights/search` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-15 | Flights | `GET /api/flights/search` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-17 | Flights | `GET /api/flights/{id}` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-19 | Flights | `POST /api/flight-bookings` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-21 | Flights | `POST /api/flight-bookings` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-22 | Flights | `POST /api/flight-bookings/hold` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-23 | Flights | `GET /api/flight-bookings/{id}/e-ticket` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-25 | Flights | `GET /api/flight-bookings`<br>`GET /api/flight-bookings/{id}` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-26 | Flights | `GET /api/flight-bookings/{id}/cancellation-quote`<br>`POST /api/flight-bookings/{id}/cancel` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-29 | Flights | `GET /api/flights/{id}/bookings`<br>`GET /api/flights/{id}/passengers/export` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| HTL-01 | Hotels | `POST /api/hotels`<br>`PATCH /api/hotels/{id}`<br>`POST /api/hotels/{id}/images`<br>`DELETE /api/hotels/{id}/images/{imageId}` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-02 | Hotels | `GET /api/hotels/{id}` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-03 | Hotels | `GET /api/hotels/{id}/rooms`<br>`POST /api/hotels/{id}/rooms` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-04 | Hotels | `POST /api/hotels/{id}/rooms/{roomId}/availability` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-05 | Hotels | `GET /api/hotels/{id}/rooms`<br>`PATCH /api/hotels/{id}/rooms/{roomId}`<br>`PATCH /api/hotels/{id}/rooms/{roomId}/availability` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-06 | Hotels | `PATCH /api/hotels/{id}/rooms/{roomId}`<br>`DELETE /api/hotels/{id}/rooms/{roomId}`<br>`PATCH /api/hotels/{id}/rooms/{roomId}/availability` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-08 | Hotels | `GET /api/hotels/{id}/availability` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-09 | Hotels | `PUT /api/hotels/{id}/policies` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-10 | Hotels | `PUT /api/hotels/{id}/policies` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-11 | Hotels | `GET /api/hotels/search` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-12 | Hotels | `GET /api/hotels/search` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-15 | Hotels | `GET /api/hotels/{id}/rooms/available` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-16 | Hotels | `POST /api/hotel-bookings` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-17 | Hotels | Shared rule or UI workflow | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-18 | Hotels | `POST /api/hotel-bookings` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-20 | Hotels | `GET /api/hotel-bookings`<br>`GET /api/hotel-bookings/{id}` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-21 | Hotels | `GET /api/hotel-bookings/{id}/cancellation-quote`<br>`POST /api/hotel-bookings/{id}/cancel` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-22 | Hotels | `GET /api/hotels/{id}/reservations` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-23 | Hotels | `POST /api/hotel-bookings/{id}/review`<br>`PATCH /api/reviews/{id}`<br>`DELETE /api/reviews/{id}` | Representative availability, room selection, reservation and staff workflows are covered. |
| HTL-24 | Hotels | `GET /api/hotels/{id}/reviews` | Representative availability, room selection, reservation and staff workflows are covered. |
| PAY-01 | Payments & Policies | `POST /api/payments`<br>`POST /api/payments/webhook`<br>`POST /api/payments/{id}/retry`<br>`GET /api/payments/{id}` | Stripe Elements completed a sandbox payment and a signed webhook confirmed the booking. |
| PAY-02 | Payments & Policies | `GET /api/bookings/{type}/{id}/policies`<br>`POST /api/bookings/{type}/{id}/accept-policies`<br>`GET /api/flight-changes/{id}/policies`<br>`POST /api/flight-changes/{id}/accept-policies` | Policy acceptance, settlement and refund scenarios are covered. |
| PAY-03 | Payments & Policies | `GET /api/refunds/{id}` | The browser cancellation produced a successful refund in the Stripe sandbox. |
| ITN-01 | Itineraries | `POST /api/itineraries`<br>`PATCH /api/itineraries/{id}`<br>`DELETE /api/itineraries/{id}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-03 | Itineraries | `GET /api/itineraries`<br>`GET /api/itineraries/{id}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-05 | Itineraries | `POST /api/itineraries/{id}/days`<br>`PATCH /api/itineraries/{id}/days/{dayId}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-07 | Itineraries | `DELETE /api/itineraries/{id}/days/{dayId}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-08 | Itineraries | `PATCH /api/itineraries/{id}/days/reorder` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-09 | Itineraries | `GET /api/itineraries/{id}/budget-summary` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-10 | Itineraries | `POST /api/itineraries/{id}/days/{dayId}/activities`<br>`PATCH /api/activities/{id}`<br>`DELETE /api/activities/{id}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-12 | Itineraries | `POST /api/activities/{id}/images`<br>`DELETE /api/activities/{id}/images/{imageId}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-14 | Itineraries | `POST /api/itineraries/{id}/days/{dayId}/budgets`<br>`GET /api/itineraries/{id}/budget-summary`<br>`PATCH /api/budgets/{id}`<br>`DELETE /api/budgets/{id}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-16 | Itineraries | `POST /api/itineraries/{id}/transport-costs`<br>`PATCH /api/transport-costs/{id}`<br>`DELETE /api/transport-costs/{id}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-18 | Itineraries | `GET /api/itineraries/{id}/budget-summary`<br>`POST /api/admin/exchange-rates/refresh`<br>`GET /api/exchange-rates` | Integration tests cover first use, conversion and cached fallback. A separate read-only check verified the configured provider response. |
| ITN-20 | Itineraries | `GET /api/itineraries/public/search`<br>`PATCH /api/itineraries/{id}` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-21 | Itineraries | `GET /api/itineraries/public/search`<br>`GET /api/itineraries/public/{id}`<br>`POST /api/itineraries/{id}/clone` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-25 | Itineraries | `GET /api/itineraries/{id}/hotels` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-26 | Itineraries | `GET /api/itineraries/{id}/flights` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| BLG-01 | Blog | `POST /api/posts` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-02 | Blog | `GET /api/posts`<br>`GET /api/posts/{id}` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-03 | Blog | `GET /api/posts/mine` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-04 | Blog | `PATCH /api/posts/{id}`<br>`DELETE /api/posts/{id}` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-05 | Blog | `POST /api/posts/{id}/comments` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-06 | Blog | `POST /api/posts/{id}/like`<br>`DELETE /api/posts/{id}/like` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-07 | Blog | `PATCH /api/comments/{id}`<br>`DELETE /api/comments/{id}` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-08 | Blog | `POST /api/posts`<br>`PATCH /api/posts/{id}`<br>`GET /api/tags/{tag}/posts` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-09 | Blog | `GET /api/posts` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-10 | Blog | `POST /api/posts/{id}/images`<br>`DELETE /api/posts/{id}/images/{imageId}` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BLG-12 | Blog | `GET /api/authors/{id}` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| GEN-01 | Cross-cutting | `GET /api/notifications`<br>`PATCH /api/notifications/{id}/read` | Representative API and cross-role browser workflows are covered. |
| GEN-02 | Cross-cutting | Shared rule or UI workflow | The API returns field errors. The frontend associates them with the relevant inputs. |
| GEN-03 | Cross-cutting | Shared rule or UI workflow | Representative browser scenarios exercise confirmations for destructive actions. |
| GEN-04 | Cross-cutting | Shared rule or UI workflow | The browser suite checks that an empty flight search gives the traveler a recovery action. |
| GEN-05 | Cross-cutting | Shared rule or UI workflow | Coverage includes ten-row collection pages and nested staff date, calendar and refund-tier lists. |
| GEN-06 | Cross-cutting | `GET /api/flights/{id}` | Search, flight details and tickets display airport-local times. |
| GEN-07 | Cross-cutting | `GET /api/admin/audit-logs` | Representative API and cross-role browser workflows are covered. |
| GEN-08 | Cross-cutting | `GET /api/media/{id}`<br>`POST /api/posts/{id}/images`<br>`POST /api/activities/{id}/images`<br>`POST /api/hotels/{id}/images`<br>`DELETE /api/hotels/{id}/images/{imageId}`<br>`POST /api/airlines/{id}/logo`<br>`DELETE /api/airlines/{id}/logo/{imageId}` | Representative API and cross-role browser workflows are covered. |
| GEN-09 | Cross-cutting | `POST /api/reports` | Representative API and cross-role browser workflows are covered. |
| GEN-10 | Cross-cutting | `GET /api/admin/reports`<br>`PATCH /api/admin/reports/{id}`<br>`PATCH /api/admin/content/{type}/{id}`<br>`DELETE /api/admin/content/{type}/{id}` | Representative API and cross-role browser workflows are covered. |
| GEN-11 | Cross-cutting | Shared rule or UI workflow | Wall-clock tests verified expiry and inventory release for both a flight and a hotel hold. |
| FLT-30 | Flights | Shared rule or UI workflow | Representative flight scheduling, search, holds and ticket workflows are covered. |
| ACC-18 | Accounts & Admin | Shared rule or UI workflow | The seed creates the administrator. Registration creates traveler accounts. |
| PAY-04 | Payments & Policies | Shared rule or UI workflow | Policy acceptance, settlement and refund scenarios are covered. |
| GEN-12 | Cross-cutting | `GET /api/countries`<br>`GET /api/cities`<br>`GET /api/attractions`<br>`GET /api/currencies` | The seed imports the supplied reference dataset and derives supported currencies. |
| GEN-13 | Cross-cutting | Shared rule or UI workflow | The API enforces validation and ownership. Regressions cover private booking references in public reviews and discovery responses. |
| ACC-19 | Cross-cutting | `POST /api/auth/refresh`<br>`GET /api/auth/me` | The API issues secure httpOnly access and refresh cookies. The frontend restores the session through /auth/me. |
| GEN-14 | Cross-cutting | Shared rule or UI workflow | Browser workflows cover navigation across roles. Independent review of information architecture remains a human check. |
| GEN-15 | Cross-cutting | Shared rule or UI workflow | Task-flow tests cover search, booking and editing. Ease of learning still calls for first-time user feedback. |
| GEN-16 | Cross-cutting | Shared rule or UI workflow | Browser tests exercise validation, recovery and responsive layouts. The separate 360-pixel check covers 20 screens. |
| GEN-17 | Cross-cutting | Shared rule or UI workflow | Shared styles and responsive layouts are implemented. Visual consistency requires human review. Figma quota prevented a fresh frame comparison. |

## Bonus

| ID | Module | Mapped API operations | Evidence scope |
| --- | --- | --- | --- |
| ACC-02 | Accounts & Admin | `GET /api/auth/verify-email` | The bonus run exercised verification and the local SMTP inbox. |
| ACC-07 | Accounts & Admin | `POST /api/auth/forgot-password`<br>`GET /api/auth/reset-password`<br>`POST /api/auth/reset-password` | The bonus run exercised reset email, token supersession and single use with a local SMTP inbox. |
| GEN-01-B | Cross-cutting | Shared rule or UI workflow | The bonus run delivered notification email to a dedicated loopback SMTP inbox. |
| FLT-27 | Flights | `PATCH /api/flight-bookings/{id}/change-flight`<br>`GET /api/flight-changes/{id}`<br>`GET /api/flight-changes/{id}/policies`<br>`POST /api/flight-changes/{id}/accept-policies`<br>`POST /api/flight-changes/{id}/payment` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| FLT-28 | Flights | `GET /api/flight-bookings/{id}/seats`<br>`PATCH /api/flight-bookings/{id}/seat` | Representative flight scheduling, search, holds and ticket workflows are covered. |
| HTL-26 | Hotels | `POST /api/reviews/{id}/reply` | Representative availability, room selection, reservation and staff workflows are covered. |
| ITN-27 | Itineraries | `POST /api/itineraries/{id}/bookings` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| ITN-28 | Itineraries | `GET /api/itineraries/{id}/pdf` | Representative itinerary editing, budgeting, search and visibility workflows are covered. |
| BLG-13 | Blog | `PATCH /api/posts/{id}/itinerary` | Representative publishing, search, comments, likes and public rendering workflows are covered. |
| BON-01 | Accounts & Admin | `GET /api/admin/analytics` | Representative account, provider and audit workflows are covered. |
| BON-02 | Cross-cutting | `POST /api/favourites`<br>`GET /api/favourites`<br>`DELETE /api/favourites/{id}` | Representative API and cross-role browser workflows are covered. |
