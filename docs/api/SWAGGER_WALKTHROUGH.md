# Swagger evaluation walkthrough

Start from the README with local HTTPS, seeded official data, and your configured external accounts. Use a separate browser profile or log out between roles. Swagger automatically adds the CSRF header after login. Do not paste access/refresh tokens into an authorization dialog.

## Preparation

1. Open `/api/health`, `/api/airports`, `/api/cities`, `/api/countries`, and `/api/currencies`.
2. Log in as the seeded administrator. Create one airline and hotel, then create their corresponding moderator accounts linked to exactly those provider IDs.
3. Attempt an administrator action as a traveler and a provider edit as the wrong moderator; expect rejection.
4. Log in as each moderator. Change the temporary password; log in again after sessions are revoked.

## Flight workflow

1. Define baggage and cancellation policies. Create a future flight using local departure/arrival times and official IATA codes.
2. Add a cabin. Show rejection of duplicate categories and invalid capacity/price.
3. Search without authentication. Exercise price bounds, sorting, passenger types, cabin filtering, and round-trip options.
4. Register/log in as a traveler. Preview passengers and totals through `POST /flight-bookings`. Demonstrate age and baggage validation.
5. Hold selected segments. Show `Pending Payment`, `holdExpiresAt`, and the snapshotted amount/policies.
6. Read policies, explicitly accept them, and create a payment. Use Stripe directly to confirm the returned test PaymentIntent.
7. Verify the signed webhook changes the booking to `Confirmed`. Read the notification and download the e-ticket.
8. Replay a success event in a controlled test; verify no second confirmation or inventory decrement.
9. Read a cancellation quote; cancel with `confirm=true`; inspect the refund and returned inventory.
10. As moderator, inspect assigned bookings and CSV export. Show that provider cancellation refunds confirmed bookings fully.

## Hotel workflow

1. Set hotel policies, add at least two rooms, and define bookable ranges.
2. Search dates requiring the requested room count and combined occupancy. Show invalid dates and empty results.
3. Hold multiple rooms together, accept policies, pay through Stripe, and inspect the confirmed reservation.
4. Demonstrate that blocking or deactivating an occupied room is rejected. Price changes must not change the booking total.
5. Show cancellation as a whole reservation and its refund. Adjacent check-out/check-in dates can use the same room.
6. Use a test fixture representing an already completed stay to demonstrate eligible reviews. There is no public endpoint to forge booking completion or payment success.

## Itineraries and community

1. Create a private itinerary with predefined countries and cities. Add days, activities, food/accommodation budgets, and transport entries.
2. Reorder and delete days. Show derived dates, sequential numbers, city groups, and category/day/group totals.
3. Set preferred currency; refresh rates as administrator; show the rate date and cached fallback during a controlled provider outage.
4. Verify another traveler cannot read a private itinerary. Publish, search, and clone it; edit/delete the original and inspect the independent private clone.
5. Create a blog draft, verify guest access is denied, publish it, and exercise tags, ranked search, comments, likes, and public author pages.
6. Report content once; resolve the report as administrator. Hidden content remains visible only to its author and administrators. Inspect the audit log.
7. Upload valid images; demonstrate format/size/count checks and private media access enforcement.

## Bonus demonstrations

- Configure the SMTP test inbox and enable email behavior. Register, verify, request password resets twice, and prove supersession, expiry, and single use.
- Change a confirmed flight to a higher fare: read and accept the replacement policy snapshot, then create its fare-difference payment. Original inventory remains valid until the additional payment commits. For a lower fare, inspect the partial refund.
- View cabin seat maps and attempt the same seat from two bookings.
- Reply to a hotel review as its assigned moderator.
- Link a confirmed booking to an itinerary once, export the itinerary PDF, and attach a public itinerary to a blog post.
- Save/remove favourites and inspect provider analytics (gross payments, refunds, and net revenue separately).

Record actual IDs, outcomes, and the environment used in a local evaluation note without saving credentials or customer information. Automated fixtures and mocked adapters do not count as account-backed external-service evidence.
