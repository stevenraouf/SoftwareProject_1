# API endpoint coverage

147 operations across 123 paths. This index is derived from the exported OpenAPI document.

| Method | Path | Requirements | Access |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | ACC-01 | Public (authentication optional) |
| POST | `/api/auth/login` | ACC-04, ACC-05 | Public (authentication optional) |
| POST | `/api/auth/refresh` | ACC-06, ACC-19 | Valid refresh cookie and matching CSRF header |
| POST | `/api/auth/logout` | ACC-06 | Public (authentication optional) |
| GET | `/api/auth/me` | ACC-04, ACC-19 | Any authenticated account |
| PATCH | `/api/auth/change-password` | ACC-08 | Any authenticated account |
| POST | `/api/auth/forgot-password` | ACC-07 | Public (authentication optional) |
| POST | `/api/auth/reset-password` | ACC-07 | Public (authentication optional) |
| GET | `/api/auth/verify-email` | ACC-02 | Public (authentication optional) |
| GET | `/api/users/me` | ACC-11 | Any authenticated account |
| PATCH | `/api/users/me` | ACC-09 | Any authenticated account |
| DELETE | `/api/users/me` | ACC-12 | Any authenticated account |
| POST | `/api/airlines` | FLT-01 | Admin |
| GET | `/api/airlines/{id}` | FLT-01 | Public (authentication optional) |
| PATCH | `/api/airlines/{id}` | FLT-01 | AirlineModerator |
| PUT | `/api/airlines/{id}/cancellation-policy` | FLT-09 | AirlineModerator |
| PUT | `/api/airlines/{id}/baggage-policy` | FLT-08 | AirlineModerator |
| GET | `/api/flights/search` | FLT-11, FLT-12, FLT-15 | Public (authentication optional) |
| POST | `/api/flights` | FLT-03 | AirlineModerator |
| GET | `/api/flights/{id}` | FLT-17, GEN-06 | Public (authentication optional) |
| PATCH | `/api/flights/{id}` | FLT-05 | AirlineModerator |
| POST | `/api/flights/{id}/cancel` | FLT-06 | AirlineModerator |
| POST | `/api/flights/{id}/cabins` | FLT-04 | AirlineModerator |
| PATCH | `/api/flights/{id}/cabins/{cabinId}` | FLT-04, FLT-05 | AirlineModerator |
| GET | `/api/flights/{id}/bookings` | FLT-29 | AirlineModerator |
| GET | `/api/flights/{id}/passengers/export` | FLT-29 | AirlineModerator |
| POST | `/api/hotels` | HTL-01 | Admin |
| GET | `/api/hotels/search` | HTL-11, HTL-12 | Public (authentication optional) |
| GET | `/api/hotels/{id}` | HTL-02 | Public (authentication optional) |
| PATCH | `/api/hotels/{id}` | HTL-01 | HotelModerator |
| POST | `/api/hotels/{id}/rooms` | HTL-03 | HotelModerator |
| PATCH | `/api/hotels/{id}/rooms/{roomId}` | HTL-05, HTL-06 | HotelModerator |
| DELETE | `/api/hotels/{id}/rooms/{roomId}` | HTL-06 | HotelModerator |
| GET | `/api/hotels/{id}/rooms/available` | HTL-15 | Public (authentication optional) |
| POST | `/api/hotels/{id}/rooms/{roomId}/availability` | HTL-04 | HotelModerator |
| PATCH | `/api/hotels/{id}/rooms/{roomId}/availability` | HTL-05, HTL-06 | HotelModerator |
| GET | `/api/hotels/{id}/availability` | HTL-08 | HotelModerator |
| PUT | `/api/hotels/{id}/policies` | HTL-09, HTL-10 | HotelModerator |
| GET | `/api/hotels/{id}/reservations` | HTL-22 | HotelModerator |
| POST | `/api/flight-bookings` | FLT-19, FLT-21 | User |
| GET | `/api/flight-bookings` | FLT-25 | User |
| POST | `/api/flight-bookings/hold` | FLT-22 | User |
| GET | `/api/flight-bookings/{id}` | FLT-25 | User |
| GET | `/api/flight-bookings/{id}/cancellation-quote` | FLT-26 | User |
| POST | `/api/flight-bookings/{id}/cancel` | FLT-26 | User |
| GET | `/api/flight-bookings/{id}/e-ticket` | FLT-23 | User |
| PATCH | `/api/flight-bookings/{id}/change-flight` | FLT-27 | User |
| GET | `/api/flight-bookings/{id}/seats` | FLT-28 | User |
| PATCH | `/api/flight-bookings/{id}/seat` | FLT-28 | User |
| POST | `/api/hotel-bookings` | HTL-16, HTL-18 | User |
| GET | `/api/hotel-bookings` | HTL-20 | User |
| GET | `/api/hotel-bookings/{id}` | HTL-20 | User |
| GET | `/api/hotel-bookings/{id}/cancellation-quote` | HTL-21 | User |
| POST | `/api/hotel-bookings/{id}/cancel` | HTL-21 | User |
| GET | `/api/bookings/{type}/{id}/policies` | PAY-02 | User |
| POST | `/api/bookings/{type}/{id}/accept-policies` | PAY-02 | User |
| POST | `/api/payments` | PAY-01 | User |
| POST | `/api/payments/webhook` | PAY-01 | Valid Stripe signature; test-mode events only |
| POST | `/api/payments/{id}/retry` | PAY-01 | User |
| GET | `/api/payments/{id}` | PAY-01 | User |
| GET | `/api/refunds/{id}` | PAY-03 | Any authenticated account |
| GET | `/api/flight-changes/{id}` | FLT-27 | User |
| GET | `/api/flight-changes/{id}/policies` | FLT-27, PAY-02 | User |
| POST | `/api/flight-changes/{id}/accept-policies` | FLT-27, PAY-02 | User |
| POST | `/api/flight-changes/{id}/payment` | FLT-27 | User |
| GET | `/api/itineraries/public/search` | ITN-20, ITN-21 | Public (authentication optional) |
| GET | `/api/itineraries/public/{id}` | ITN-21 | Public (authentication optional) |
| POST | `/api/itineraries` | ITN-01 | User |
| GET | `/api/itineraries` | ITN-03 | User |
| GET | `/api/itineraries/{id}` | ITN-03 | Any authenticated account |
| PATCH | `/api/itineraries/{id}` | ITN-01, ITN-20 | User |
| DELETE | `/api/itineraries/{id}` | ITN-01 | User |
| POST | `/api/itineraries/{id}/days` | ITN-05 | User |
| PATCH | `/api/itineraries/{id}/days/reorder` | ITN-08 | User |
| PATCH | `/api/itineraries/{id}/days/{dayId}` | ITN-05 | User |
| DELETE | `/api/itineraries/{id}/days/{dayId}` | ITN-07 | User |
| POST | `/api/itineraries/{id}/days/{dayId}/activities` | ITN-10 | User |
| POST | `/api/itineraries/{id}/days/{dayId}/budgets` | ITN-14 | User |
| POST | `/api/itineraries/{id}/transport-costs` | ITN-16 | User |
| GET | `/api/itineraries/{id}/budget-summary` | ITN-09, ITN-14, ITN-18 | Any authenticated account |
| POST | `/api/itineraries/{id}/clone` | ITN-21 | User |
| GET | `/api/itineraries/{id}/hotels` | ITN-25 | User |
| GET | `/api/itineraries/{id}/flights` | ITN-26 | User |
| POST | `/api/itineraries/{id}/bookings` | ITN-27 | User |
| GET | `/api/itineraries/{id}/pdf` | ITN-28 | User |
| PATCH | `/api/activities/{id}` | ITN-10 | User |
| DELETE | `/api/activities/{id}` | ITN-10 | User |
| PATCH | `/api/budgets/{id}` | ITN-14 | User |
| DELETE | `/api/budgets/{id}` | ITN-14 | User |
| PATCH | `/api/transport-costs/{id}` | ITN-16 | User |
| DELETE | `/api/transport-costs/{id}` | ITN-16 | User |
| GET | `/api/posts/mine` | BLG-03 | User |
| GET | `/api/posts` | BLG-02, BLG-09 | Public (authentication optional) |
| POST | `/api/posts` | BLG-01, BLG-08 | User |
| GET | `/api/posts/{id}` | BLG-02 | Public (authentication optional) |
| PATCH | `/api/posts/{id}` | BLG-04, BLG-08 | User |
| DELETE | `/api/posts/{id}` | BLG-04 | User |
| POST | `/api/posts/{id}/comments` | BLG-05 | User |
| POST | `/api/posts/{id}/like` | BLG-06 | User |
| DELETE | `/api/posts/{id}/like` | BLG-06 | User |
| PATCH | `/api/posts/{id}/itinerary` | BLG-13 | User |
| PATCH | `/api/comments/{id}` | BLG-07 | User |
| DELETE | `/api/comments/{id}` | BLG-07 | User |
| GET | `/api/tags/{tag}/posts` | BLG-08 | Public (authentication optional) |
| GET | `/api/authors/{id}` | BLG-12 | Public (authentication optional) |
| POST | `/api/hotel-bookings/{id}/review` | HTL-23 | User |
| PATCH | `/api/reviews/{id}` | HTL-23 | User |
| DELETE | `/api/reviews/{id}` | HTL-23 | User |
| GET | `/api/hotels/{id}/reviews` | HTL-24 | Public (authentication optional) |
| POST | `/api/reviews/{id}/reply` | HTL-26 | HotelModerator |
| POST | `/api/reports` | GEN-09 | User |
| POST | `/api/admin/moderators` | ACC-13 | Admin |
| GET | `/api/admin/accounts` | ACC-14 | Admin |
| POST | `/api/admin/users/{id}/reset-password` | ACC-07a | Admin |
| PATCH | `/api/admin/accounts/{id}/suspend` | ACC-15, ACC-16 | Admin |
| PATCH | `/api/admin/accounts/{id}/reactivate` | ACC-15, ACC-16 | Admin |
| PATCH | `/api/admin/providers/{type}/{id}/deactivate` | ACC-15 | Admin |
| PATCH | `/api/admin/providers/{type}/{id}/reactivate` | ACC-15 | Admin |
| GET | `/api/admin/bookings` | ACC-17 | Admin |
| GET | `/api/admin/reports` | GEN-10 | Admin |
| PATCH | `/api/admin/reports/{id}` | GEN-10 | Admin |
| PATCH | `/api/admin/content/{type}/{id}` | GEN-10 | Admin |
| DELETE | `/api/admin/content/{type}/{id}` | GEN-10 | Admin |
| GET | `/api/admin/audit-logs` | GEN-07 | Admin |
| GET | `/api/admin/analytics` | BON-01 | Admin |
| POST | `/api/admin/exchange-rates/refresh` | ITN-18 | Admin |
| GET | `/api/airports` | FLT-02 | Public (authentication optional) |
| GET | `/api/countries` | GEN-12 | Public (authentication optional) |
| GET | `/api/cities` | GEN-12 | Public (authentication optional) |
| GET | `/api/attractions` | GEN-12 | Public (authentication optional) |
| GET | `/api/currencies` | GEN-12 | Public (authentication optional) |
| GET | `/api/health` |  | Public (authentication optional) |
| GET | `/api/notifications` | GEN-01 | Any authenticated account |
| PATCH | `/api/notifications/{id}/read` | GEN-01 | Any authenticated account |
| POST | `/api/favourites` | BON-02 | User |
| GET | `/api/favourites` | BON-02 | User |
| DELETE | `/api/favourites/{id}` | BON-02 | User |
| GET | `/api/exchange-rates` | ITN-18 | Any authenticated account |
| GET | `/api/media/{id}` | GEN-08 | Public (authentication optional) |
| POST | `/api/posts/{id}/images` | BLG-10, GEN-08 | Any authenticated account |
| DELETE | `/api/posts/{id}/images/{imageId}` | BLG-10 | Any authenticated account |
| POST | `/api/activities/{id}/images` | ITN-12, GEN-08 | Any authenticated account |
| DELETE | `/api/activities/{id}/images/{imageId}` | ITN-12 | Any authenticated account |
| POST | `/api/hotels/{id}/images` | HTL-01, GEN-08 | Any authenticated account |
| DELETE | `/api/hotels/{id}/images/{imageId}` | HTL-01, GEN-08 | Any authenticated account |
| POST | `/api/airlines/{id}/logo` | FLT-01, GEN-08 | Any authenticated account |
| DELETE | `/api/airlines/{id}/logo/{imageId}` | FLT-01, GEN-08 | Any authenticated account |
