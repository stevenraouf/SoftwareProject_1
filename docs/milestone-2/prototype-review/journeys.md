# Prototype journey comparison

Baseline review of commit `2a7dbca`. [Implementation and retest](implementation.md)

The three starting frames open the Paris window on [desktop][desktop], [tablet][tablet] and [phone][phone]. The first URL also points to the [desktop Cairo arrival][cairo]. The comparison follows links from those frames into the public site, traveler flows and reviewer workspace. The dedicated airport picker, alternate seat list and editorial features below are concrete gaps a traveler can encounter.

## How to read the evidence

The delivered Figma frame guide and its `NATIVE-FRAMES.ndjson` inventory identify each frame, its controls and their destinations. The archived inventory contains 2,236 frame instances. Following its recorded destinations from each supplied start reaches 748 distinct named states, including design guides and API examples. The tablet and phone flows also reach the desktop reviewer launcher. Later motion overlays have separate verification records. The inventory establishes which screens are connected. The comparisons below inspect representative states across all 15 guide chapters. Exact visual and motion parity across every state remains unverified.

The implementation links point to the component or browser test behind each finding. Dates, names, availability, seat labels and prices change with the application data. The comparison checks where information appears and what a traveler can do with it. The prototype’s scripted sample checkout and the running application’s Stripe integration have different verification requirements.

## Public and traveler journeys

| Guide chapter | Behavior present | Difference or extent of the check |
| --- | --- | --- |
| Window portal | Eight selectable destinations, localized arrivals and a phone flight-form shortcut. [Window component][window-code] · [Browser tests][window-tests] | Browsing updates the selected destination and rail position. The prototype passes through a distinct shuffle frame on the way to the next window. The first URL’s Cairo arrival has its own design reference. [Paris start][desktop] · [Cairo arrival][cairo] |
| Flight search | The flight form accepts airport codes and lets travelers choose dates, party size and cabin. [Search form][flight-form] | The prototype’s Flights link opens a destination picker with named airport rows, country, code and selected origin. The app opens a single form with three-character inputs and a browser datalist. [Destination picker][destination] · [Header links][header-links] |
| Flight booking | Fare selection, additional baggage, a quote, a timed hold and policy consent are implemented. The browser test checks the USD 205 one-extra-bag total on its fixture. [Hold test][hold-test] · [Checkout][checkout-code] | After confirmation the prototype offers a second seat-selection view listing available seats with descriptions such as Window or Aisle. The app provides a labeled seat grid with disabled occupied seats and a passenger selector. It lacks the separate list/map toggle. [Seat map][seat-map] · [Seat list][seat-list] · [Seat picker][picker-code] |
| Flight variants | Outbound and return fares, adults, children and lap infants are supported. A browser test checks that the chosen return leg survives sign-in. [Round-trip test][round-test] | The prototype asks for the outbound before moving to a separate return selection. The app displays outbound and return sections on one results page. Individual family, cabin and payment variants received no frame-by-frame visual check. [Outbound selection][round-out] · [Results sections][leg-results] |
| Account | Sign-in, registration, email verification, recovery, profile updates and forced password changes are implemented. An interrupted traveler can return to the requested URL. [Account flow][account-code] · [Email verification][verify-code] | The linked frames distinguish sign-in and verification. The app shares account form and feedback components. The layout and motion of all lockout, suspension and recovery variants remain unverified. [Sign-in][login-frame] · [Email verification frame][verify-frame] |
| Flights | The alternative flight-search flow also maps to the app’s search, filters, sorting and recovery from empty results. [Empty-result browser test][empty-test] | This is a separate prototype chapter from the cabin’s destination picker. Several result, filter and ordering frames correspond to a single expandable “Price filters & sorting” form in the app. [Flight search frame][other-flights] · [Filters and sorting][filters-code] |
| Stays | Guests can search by location and dates, request multiple rooms, compare availability and retain their choices through sign-in. [Two-room and sign-in tests][stay-tests] | The prototype opens separate date and rooms/guests views from search. The app places native date fields and guest/room number fields in the search form. [Stay search][stay-search] · [Stay dates][stay-dates] · [Rooms and guests][stay-guests] · [App controls][stay-fields] |
| Bookings | The app shows a saved seat per seated passenger and flight. A browser test selects a seat, reloads the ticket, checks its label, and retrieves the PDF. [Saved-seat test][seat-test] | The prototype opens a distinct e-ticket document preview and returns to booking management. The app combines the itinerary, seat assignments, PDF link and eligible management actions on the booking-detail page. [Ticket preview][ticket-frame] · [Booking page][ticket-code] |
| Trip planner | Public filtering, itinerary creation, budgeting and sharing are implemented. A browser test publishes a plan and reads it as a guest. [Planner test][planner-test] | The guest design presents an actionable featured itinerary with its author and duration beside a separate route-discovery panel. The app opens with a passive Eiffel Tower photo and “Your itinerary”, followed by tabs, filters and results. [Guest planner][planner-frame] · [Planner header and tabs][planner-code] |
| Community | Public search, author pages, publishing, liking and comments are implemented. [Journal component][journal-code] · [Author workflow test][journal-test] | The guest journal design features a story with author and engagement counts, alongside a notebook invitation. The app uses a passive photo header, notebook tabs and a search panel above the result cards. The missing featured treatment is independent of which stories are in the database. [Guest journal][journal-frame] · [Journal header and tabs][journal-code] |

## Staff, handoff and shared design

| Guide chapter | Behavior present | Difference or extent of the check |
| --- | --- | --- |
| Operations workspace | Staff access follows the signed-in role. The browser cases cover an administrator updating a provider, an airline moderator scheduling a flight and a hotel moderator inspecting availability. [Role handling][roles-code] · [Staff tests][staff-tests] | The airline overview design surfaces the next departure and cabin capacity. The hotel overview shows individual rooms and a reservation. The app’s provider overview instead offers three navigation buttons for each role, with the records inside the respective tabs. [Airline overview][airline-frame] · [Hotel overview][hotel-frame] · [Provider overview][staff-overview] |
| Workspace actions | An administrator can set a temporary password after confirming the action and receive success feedback. [Reset form][reset-code] | The example uses a separate review frame and completion frame. The app handles the operation on the account row. This comparison samples the reset action. Visual equivalence across the chapter’s other confirmations and outcomes remains unverified. [Review example][reset-frame] · [Completion example][reset-done] |
| Design handoff | The app exposes guest navigation and directs signed-in staff to their workspace. [Site navigation][header-links] · [Role handling][roles-code] | The prototype’s public Workspaces link opens a reviewer launcher with scenario shortcuts, including administrator, airline and hotel examples. The app footer offers public travel links, motion controls and credits. The launcher belongs to the prototype review experience. [Reviewer launcher][review-frame] · [App footer][footer-code] |
| Foundations and artwork | The shared header displays the cabin signature. The footer can replay it, and the site exposes a reduced-motion preference. [Signature][signature-code] · [Footer controls][footer-code] | Figma opens a signature replay overlay. The app replays the mark in the header and scrolls to it. This comparison covers the entry and presentation of replay. Individual component-library swatches and artwork layers received no per-layer review here. [Replay overlay][replay-frame] · [Replay handler][replay-code] |
| Milestone 1 workflows | Checkout reads policy acceptance and payment state, shows a waiting message during confirmation, and can refresh the booking. [Checkout][checkout-code] | Prototype frames illustrate settlement and recovery using sample outcomes. Checking the presence of those states and UI messages cannot establish a live payment, webhook or refund outcome. Those require service-level evidence. [Settlement walkthrough][settlement-frame] · [Pending example][pending-frame] · [Payment state handling][pending-code] |

[desktop]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=27-9726
[tablet]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=27-9839
[phone]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=27-9952
[cairo]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=27-9741
[destination]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=14-69499
[seat-map]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=14-72870
[seat-list]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=14-72945
[round-out]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=14-75663
[login-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-8456
[verify-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-7347
[other-flights]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-403
[stay-search]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-11350
[stay-dates]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-12697
[stay-guests]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-12954
[ticket-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=14-72816
[planner-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-15690
[journal-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-16815
[airline-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-19070
[hotel-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-19953
[reset-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=14-77310
[reset-done]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=14-77333
[review-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=8-54740
[replay-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=20-164874
[settlement-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=39-38255
[pending-frame]: https://www.figma.com/design/2Mj6tE37oslEGuxRvFYjsq/Travel-Planning-and-Booking-Platform?node-id=39-38262
[window-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/components/home.tsx#L217
[window-tests]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/home.spec.ts
[flight-form]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/flights.tsx#L231
[header-links]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/components/shell.tsx#L8
[hold-test]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/booking.spec.ts#L39
[checkout-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/payment.tsx#L94
[picker-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/trips.tsx#L270
[round-test]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/booking.spec.ts#L201
[leg-results]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/flights.tsx#L330
[account-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/components/account.tsx#L66
[verify-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/components/verify-email.tsx#L8
[empty-test]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/booking.spec.ts#L252
[filters-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/flights.tsx#L301
[stay-tests]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/booking.spec.ts#L73
[stay-fields]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/stays.tsx#L99
[seat-test]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/booking.spec.ts#L162
[ticket-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/trips.tsx#L458
[planner-test]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/discovery.spec.ts#L22
[planner-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/discovery/planner.tsx#L52
[journal-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/discovery/journal.tsx#L203
[journal-test]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/discovery.spec.ts#L97
[roles-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/staff/index.tsx#L123
[staff-tests]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/tests/staff.spec.ts#L44
[staff-overview]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/staff/index.tsx#L59
[reset-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/staff/admin.tsx#L247
[footer-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/components/shell.tsx#L162
[signature-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/components/shell.tsx#L14
[replay-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/components/shell.tsx#L191
[pending-code]: https://github.com/stevenraouf/SoftwareProject_1/blob/2a7dbca473adf7274a5bf6987858a6b396df6f27/frontend/src/features/booking/payment.tsx#L234
