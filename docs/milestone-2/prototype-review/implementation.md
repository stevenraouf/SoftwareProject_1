# Frontend implementation of the AERIS prototype

The frontend now carries a traveler from a country window through a localized arrival into a dedicated flight draft. On the desktop link, select Egypt and explore it. Both **Fly to CAI** and **Choose CAI** open **Flights to Cairo** with Dubai as departure. Returning to the windows keeps Egypt selected. The draft supports changing airports, dates, trip type and party before submitting to the flight-search API. [Original comparison](README.md) · [Cairo in Figma and the updated frontend](updated/desktop-cairo.jpg)

## What changed

| Area | Implemented behavior |
| --- | --- |
| Cabin homepage | Eight photographic destinations, a fixed window with overlapping photographs during a shuffle, and a visible skip control. Tablet shows five full destination cards and four flight fields in the first row. Phone provides a same-page flight shortcut and a full-width search action. [Desktop](updated/desktop-paris.jpg) · [Tablet](updated/tablet-paris.jpg) · [Phone](updated/phone-paris.jpg) |
| Arrivals and booking drafts | Each arrival places a regional greeting and story over its photograph, with the destination airport above the form. The dedicated draft shows both airports and their time zones. The airport chooser supports search and cancel. New drafts use the prototype’s May 2027 dates while those dates are current or upcoming. Once a sample date passes, the default advances seven days from the current date. |
| Shared motion | The incoming view tilts over the outgoing photo. Two cloud banks cover a page change before the destination appears. Headings have character reveals and a timed highlight, and destination greetings enter as whole words. The signature opens in a replay dialog with a still option. The site honors the device’s reduced-motion setting and remembers the site preference across reloads. |
| Flights and tickets | Flight results have separate fare-filter and sort views. For a round trip the traveler chooses the outbound before choosing the return. The seat chooser shares selections between a map and a list labeled Window, Middle and Aisle. The separate e-ticket document shows times, passengers and their saved seats for each flight, with actions to change a seat, return to the booking or download the PDF. |
| Stays, planner and journal | Stays has separate date and room/guest pickers, including keyboard use and cancellation. The public planner and journal feature real itineraries and published stories. Search results, privacy and sign-in handoffs use the existing services. [Stays](updated/desktop-stays.jpg) · [Planner](updated/desktop-planner.jpg) · [Journal](updated/desktop-journal.jpg) |
| Workspaces | The assigned airline’s overview shows upcoming departures and next-flight cabin capacity. Hotel moderators see room inventory and their latest reservation. Administrators have a dedicated temporary-password review and completion dialog. The public Workspaces link uses the application's existing staff sign-in and role checks. |

## Verification

To repeat the browser walkthrough, start the project using the [local setup](../../../README.md), open the homepage and select **Egypt → Explore Egypt → Choose CAI**. On the flight draft, **Explore Cairo → Back to windows** restores the Giza window. On a phone, **Replay logo** in the footer opens the signature player. To repeat the automated homepage checks in a visible Edge window, run the following from the frontend directory after installing the project and setting up its local certificates.

```powershell
npm.cmd run build
npm.cmd run test:browser -- tests/home.spec.ts --headed
```

The production build and TypeScript check passed. All 22 Edge browser tests passed against a disposable, seeded MongoDB replica set. All six homepage cases also passed in headed Edge, including the desktop screenshot that previously timed out. Separate viewport checks followed all 24 destination/size combinations into the arrival and flight draft, compared the greeting with native Figma text, verified the airport pair, then returned to the selected window. The backend passed 64 tests and recorded successful responses for all 151 documented API operations. [Recorded test results](verification.json)

A separate browser checkout used Stripe Elements in test mode. It paid USD 180.00, received the signed confirmation, opened the flight e-ticket, returned to booking management and verified the USD 162.00 refund after cancellation. The public site loads Stripe when the traveler opens payment details.

One local test launch timed out while seeding its disposable database, before any browser cases ran. A fresh fixture completed the full run. The recorded headed run captured the homepage successfully.

The five main screenshot pairs use the same native Figma exports as the [baseline](README.md) alongside captures from the final production build. Planner and Journal use an independent production run with seeded public content. The tablet and Cairo reference exports predate the prototype’s final airport-default revision. The live player and the later native records supplied the route values. Titles, available flights, rooms, stories, stored seats and fares in the application reflect its data. The prototype’s reviewer-only sample scenarios remain in Figma.

The browser selected the narrow window photograph for phone arrivals and destination thumbnails, and the wide landscape for tablet and desktop arrivals. All 16 destination JPEGs matched the native source files byte for byte. Font rendering, button spacing and some vertical dimensions still vary slightly. The website retains the existing **Find a stay in Cairo** link below the flight form, which places the footer lower than in Figma. Stays leaves dates open for the traveler and retains its optional price, rating and sort controls.

Verification covers the specified journeys, screen sizes and recorded interactions. The [748-state design inventory](figma-states.csv) includes sample service outcomes and reviewer pages. It has no per-layer visual pass for every state.
