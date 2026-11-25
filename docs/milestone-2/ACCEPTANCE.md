# Milestone 2 acceptance review

25 November 2026. The review covered the six deliverables in section 13.2 of the [course brief](../../Objectives/GIU_2617_70_35615_2026-11-03T10_05_28.pdf) and the 104 mandatory rows in the [requirements workbook](../../Objectives/Final_%20SP1_Reviewed_Requirements.xlsx). The 11 bonus rows were counted separately. A fresh extraction matched the local register on every row, including wording, dependencies and classification. [Requirement-to-source index](../requirements/TRACEABILITY.md)

## Required deliverables

The subsequent prototype review covers desktop, tablet and phone, including the changes to the Cairo booking flow. [Frontend implementation and retest](prototype-review/implementation.md)

| Deliverable | How to check it |
| --- | --- |
| Complete Next.js frontend | Start the site and visit the guest, traveler, airline moderator, hotel moderator and administrator screens. The [handover](HANDOVER.md) describes each workspace. |
| Integrated backend and frontend | The production frontend calls the NestJS REST API. The browser suite creates and reads records in a disposable MongoDB replica set. Stripe Elements, signed webhooks and SMTP were also exercised separately with test services. |
| Mandatory workflows for all roles | The table below identifies the scenarios checked for each workbook module. The [test evidence](evidence/acceptance-2026-11-25.json) records the measured results. |
| Final README and setup | The [README](../../README.md) covers fresh installation, local HTTPS, database setup, demo seeding, browser tests, the checkout listener and the Windows launcher. |
| Updated AI prompt log | The [prompt log](../../AI_PROMPTS.txt) records the material requests, implementation, verification and the student's role in reviewing the output. |
| GitHub contribution history | Use the [Milestone 2 review branch](https://github.com/stevenraouf/SoftwareProject_1/tree/feature/milestone-2-frontend) for the integrated version. Its history includes the backend integration, original frontend implementation, verification and subsequent corrections. |

## Workbook coverage

| Module | Mandatory rows | Checks and changes |
| --- | ---: | --- |
| Accounts and administration | 16 | Registration errors appear beside the affected field. A forced password change preserves the original destination through the next login. The account and staff tests exercise traveler access, moderator setup, provider management and the audit trail. |
| Flights | 20 | Search rejects invalid airports. Guest fare choices survive sign-in. Coverage includes local flight times, capacity, baggage, holds, cancellation and ticket access. |
| Hotels | 20 | A guest can select rooms before signing in. The application carries room IDs, dates and group size through login and checks availability again. Traveler details are entered after login. Tests cover past-date rejection, a multi-room hold and provider room availability. |
| Payments and policies | 4 | Policy acceptance persists with its timestamp. Long tier lists are paginated, and booking amounts display the settlement currency. Integration tests cover status transitions, duplicate events and refunds. |
| Itineraries | 15 | Coverage includes editing days, budgets, currencies, linked searches, publishing, privacy and cloning. Public displays omit private booking references. |
| Blog | 11 | Tests cover draft and published stories, tags, images, comments, likes, author pages and changes to the visibility of attached itineraries. |
| Cross-cutting | 18 | Checks cover permissions, validation, paging, media, moderation, notifications, hold expiry and responsive layouts. Staff pagination tests make changes on page two and confirm that records on page one are preserved. |

## Verified outcomes

Both production builds and TypeScript checks passed, as did backend ESLint. All **64 backend tests and 17 Edge browser tests** passed. Each of the **151 documented API operations** returned a successful response in the integration suite. The configured Atlas database authenticated and completed a read-only transaction, which the verifier aborted. An additional check found no horizontal overflow on 20 screens at 360 pixels across all five roles.

The unpaid flight and hotel reservations were still pending six seconds before their ten-minute deadlines. One second after the deadlines, both had expired, the seat and room nights were available again, and new reservations succeeded. The check used the normal worker and real elapsed time.

A browser checkout charged **USD 180.00** through Stripe Elements in test mode. The signed event confirmed the booking and browser cancellation produced a **USD 162.00** refund. All 11 optional scenarios also passed in a separate run using Stripe's sandbox and a local mail inbox. [Measured results](evidence/acceptance-2026-11-25.json)

## What still needs a person


The student must review the AI-assisted changes and be able to explain the implementation and rendering choices during evaluation. The course workflow calls for review before merging to `develop` and releasing to `main`. The functional tests exercise representative scenarios within the workbook rows. Ease of use and visual consistency also call for human judgment. The Figma Starter account reached its screenshot quota, so this review could not make a fresh frame-by-frame comparison.
