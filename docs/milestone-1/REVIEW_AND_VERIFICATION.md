# Engineering review and verification

## Current acceptance state

The backend has a passing local verification baseline. It is not an exhaustive acceptance certificate. A follow-up [coverage audit](COVERAGE_AUDIT.md) found and corrected additional conformance issues. Atlas connection, index initialization, repeatable reference/administrator seeding and HTTPS startup/login checks passed on 13 November 2026; see [Atlas setup evidence](evidence/atlas-setup.json). The full core Stripe sandbox/Atlas verification passed on 15 November: decline/retry, actual signed events, flight/hotel confirmation, tier/provider refunds, and real ten-minute hold expiry/cancellation. **The submission release gate remains open**: GitHub publication/CI, actual SMTP delivery for bonuses, the sole student's own recorded review and final acceptance checks remain pending. Additional edge cases/fare changes retain their local fixture evidence until repeated externally. Milestone 2 UI work is separate.

This is an AI-assisted engineering self-review. There is one human student/developer. No student approval, additional team member, GitHub publication or instructor acceptance is invented. The [policy record](AI_POLICY_AND_SOLO_SUBMISSION.md) distinguishes AI checks from the student's own review; a second teammate is not a prerequisite imposed by this repository.

On 14 November 2026, the API audit expanded the suite from 46 to 56 passing tests and measured successful HTTP workflows for all 147 documented operations. The global permission matrix passed 120 anonymous, 100 wrong-role and 86 missing-CSRF checks. See [the API test report](API_TEST_REPORT.md). These workflows use an isolated real replica set and fixture Stripe/SMTP adapters; the live Atlas application was checked separately with 11 public GET requests. Operation coverage is not exhaustive requirement acceptance.

## Executed evidence

| Check | Result | Evidence / limits |
| --- | --- | --- |
| TypeScript | Passed | `npm.cmd run typecheck`; strict compiler configuration |
| ESLint | Passed | `npm.cmd run lint`; unused-code and recommended TypeScript rules |
| Compiled backend | Passed | `npm.cmd run build`; native ES modules on Node 22.14.0 |
| Fresh checkout / install | Passed | `clean-checkout.json`; separate clone, fresh node_modules, npm ci, type checking, lint, 46 tests, and build |
| Unit/integration suite | **56 passed, 0 failed**, two suites | Latest: `evidence/api-test-results.json`; six unit and 50 HTTP/replica-set scenarios. `test-results.json` preserves the earlier 46-test baseline. |
| Complete API operation coverage | **147/147 successful workflows** | `evidence/api-route-coverage.json`, observed from completed HTTP requests; gate rejects an untested documented operation. 120 anonymous/100 incorrect-role/86 missing-CSRF checks passed. |
| Running Atlas-backed API | **11 public GET checks passed** | `evidence/live-api-readonly.json`; verified local TLS certificate, health/database connectivity, four reference lists, currencies, posts/public itinerary search, Swagger assets and response-specific OpenAPI examples. No credentials, cookies or body data retained. |
| VS Code browser inspection | Passed, limited scope | Swagger rendered in the user's VS Code browser; navigated to public health and observed database=true, then restored Swagger. This did not click through all 147 operations or constitute the student's review. |
| Transaction behavior | Passed locally | Real disposable MongoDB 8.2.6 replica set; no mocked database for inventory checks |
| Live MongoDB Atlas connection | Passed, limited scope | 13 November 2026: `npm.cmd run check:atlas --prefix backend` exited 0; authentication/ping and a read-only snapshot transaction succeeded. Transaction was aborted; no data written. Does not establish write permissions, indexes, seed or application startup. |
| Atlas application setup | Passed, limited scope | `evidence/atlas-setup.json`: fresh build, 28 models/indexes initialized; 8 each of official countries/cities/airports/attractions preserved; reference and user-configured administrator seeds repeated without duplicate records. Compiled `createApp`, `seedReference` and `seedAdmin` were exercised directly. |
| Atlas HTTPS/authentication | Passed | Certificate-verified loopback HTTPS: health/countries/Swagger 200; admin login 201; secure HttpOnly access/refresh cookies; authenticated me 200; missing-CSRF mutation rejected 403; logout 201; revoked session rejected 401. Verification session revoked; no bookings/payments/email created. |
| Local TLS certificate | Generated successfully | Ignored `.certs/` files; self-signed localhost certificate |
| Compiled HTTPS smoke | **Five checks passed** | `https-smoke.json`; actual HTTPS requests, Swagger HTML/JavaScript, secure cookies, CSRF and real FX fetch/cache |
| Account-backed Stripe sandbox and Atlas | **Full core run passed, 15 November** | `evidence/stripe-account-verification.json`: real declined payment/retry, real signed-event IDs, flight/hotel confirmation, $7.50 traveler flight refund, $10 full provider refund, $15 hotel refund, actual ten-minute unpaid hold expiry, Stripe cancellation and released inventory. No mock or locally fabricated webhook in this run. |
| Swagger/OpenAPI | Exported | 147 operations across 123 paths; source-derived role/access and requirement metadata |
| Source traceability | Generated | All 115 workbook rows; 104 mandatory and 11 bonuses; source text preserved |
| Official seed | Passed locally and repeated | Eight airports, attractions, cities and countries; unique identifiers preserved |
| Real FXRatesAPI | Passed | Backend fetched/cached the service's actual response; observed rate date recorded in HTTPS report |
| Production dependency audit | See JSON evidence | `production-dependency-audit.json`; expected zero reported production advisories at this verification |
| Development dependency audit | Low-severity findings remain | `dependency-audit.json`; deepmerge in the Jest toolchain has no nonbreaking patched upgrade offered by npm |

Machine-readable reports are authoritative if counts change after a later run. Re-run the documented commands after changing the source. Tests are representative acceptance scenarios, not proof that every possible input or deployment has been covered.

## Reviewed and corrected findings

| Finding | Severity | Resolution and verification |
| --- | --- | --- |
| NestJS 12 ES modules were incompatible with the initial CommonJS Jest setup | Blocker | Converted source/build/test configuration to native ESM; runtime and all suites pass |
| A type/value import exposed a nonexistent Mongoose runtime export | Blocker | Split connection/session types from runtime imports; compiled server and tests pass |
| MongoDB index builds failed on low free space on C: | Environment blocker | Added a scoped `TEST_TMP_DIR`; real replica-set tests ran on D: without lowering MongoDB safeguards |
| Application creation could leave a connection open after index initialization failure | Major | Await all model initialization results and close the app before propagating failure |
| Hidden test-storage paths were refused by Express's default file behavior | Major | Permit the application's validated storage path while preserving generated filenames and parent access checks; private-media and clone-survival regressions pass |
| Confirmation could race account/provider deactivation | Major | Serialize through current account/provider writes inside confirmation transactions; unfulfillable payments compensate with refunds |
| Completed hotel allocations could unnecessarily prevent later inventory changes | Major | Release allocation rows when the reservation becomes Completed; restart-safe worker regression passes |
| Public itinerary detail could expose private booking link identifiers | Major | Omit booking links for nonowners; clones copy numeric costs rather than private references; regression passes |
| Clone media and linked costs could depend on the original itinerary | Major | Independent IDs/media records and cost snapshots; deleting originals preserves clone access and totals |
| Room-availability and room-status collection endpoints needed page-size enforcement | Minor | Added ten-row pagination and explicit HTTP regressions |
| Capacity reduction could remove a selected seat even when booked-count limits passed | Minor | Reject reductions excluding assigned labels |
| A payment uniqueness key could prevent a second paid flight change on the same booking | Major | Include change ID in payment uniqueness and permit only one active change per booking; repeated paid-change regression added |
| Fare-difference payment needed a separate acceptance record for replacement provider policies | Major | Added replacement-policy read/accept APIs and enforced the timestamp before creating the change payment; HTTP regression added |
| Unspecified nine-seat group limit and inconsistent partial updates | Major | Removed the nine-seat cap, preserved omitted patch fields and rejected invalid null input; follow-up regressions pass |
| Hotel-detail reviews lacked deactivated-author labels | Major | Applied shared author formatting consistently; follow-up regression passes |
| Stripe SDK changed its allowed-payment-method parameter | Compatibility | Updated to the installed SDK's documented type surface; adapter/HTTP signature tests pass |
| Development glob/minimatch advisories | Dependency | Pinned patched overrides and reran the suite; low-severity Jest/deepmerge findings remain documented |

The temporary-download cleanup attempt was rejected by automatic approval review. That file was left untouched. Tests instead used an explicitly scoped disposable database on D:; the rejection did not prevent verification.

The 14 November API audit also corrected Swagger's error examples, which previously showed statusCode 400 under every error status. Response-specific examples now match 400/401/403/404/409/500/503. A regression covers every operation; the rebuilt/restarted server's live OpenAPI check confirms the correction.

The first 46-test run passed but measured only 87 exercised operations (80 with successful responses). New workflows filled the gaps. Initial expanded-test failures exposed incorrect test assumptions/fixtures (incomplete FX payload, treating flight preview as a saved hold, expecting database rather than API list identifiers, missing delete confirmation); these fixtures were corrected. Refresh deliberately returns 401 for invalid/missing CSRF combined with refresh credentials, whereas ordinary protected mutations return 403. The final 56-test run passed. No independent human approval is inferred.

## Coverage performed

- Authentication validation, uniqueness, secure cookie attributes, role/CSRF enforcement, lockout, idle expiry, rotation, logout, suspension and temporary-password restrictions.
- Real database contention for the last seat, atomic round-trip failure, overlapping room reservations, all-or-nothing multi-room rollback, adjacent stays and expired release.
- Snapshotted fare/policy behavior, signed HTTP events, incorrect payment amounts, duplicate events, late-payment compensation, user/provider cancellation, refund failure and recovery.
- Positive/negative fare changes, reference preservation, seat uniqueness and original-inventory preservation.
- Itinerary ordering, dates, city subtotals, multi-currency totals, 60-day limits, nested ownership, public/private visibility, clone independence, linked costs and blog attachments.
- Draft/public posts, tags, pagination, likes, comment ownership, unique reports, moderation visibility, audits, completed-stay reviews and moderator replies.
- Validated images, private access, independent clone media, favourites, notification ownership, email token gates/supersession/single-use and interrupted mail-job recovery.
- Actual compiled HTTPS behavior and the actual public FXRatesAPI fetch/cache, independently of test rate fixtures.

## What remains externally unverified

| Dependency / decision | Required next evidence |
| --- | --- |
| MongoDB Atlas | Connection, index/reference/admin seed, HTTPS authentication and core real Stripe booking/refund/expiry checks passed. Exhaustive concurrency and all financial edge cases still rely on disposable-replica-set scenarios. |
| Stripe test account | Full core sandbox verification passed on 15 November. Account-backed fare differences, late-success compensation, refund failure and restart scenarios have not all been repeated externally; their fixture tests remain separate evidence. See `STRIPE_VERIFICATION_REPORT.md`. |
| SMTP test inbox | Enable email bonuses with configured SMTP and observe verification/reset/invitation/notification delivery |
| GitHub | `origin` connected to the supplied SoftwareProject_1 repository; inspected empty on 15 November. Genuine commit publication and an actual GitHub CI run remain pending. |
| Sole student's human review | Review the actual source/version and perform the walkthrough using the solo discussion guide; record the real date/findings. No additional teammate or prior approval is invented |
| Browser and frontend | Swagger rendering and public live-health navigation were checked in VS Code. Full browser workflow/accessibility review and all Next.js/UI requirements remain separate; automated HTTPS workflows are not 147 manual UI interactions. |

## Operational limits to retain in review

Search/analytics assemble candidate results in memory and have not been load-tested. Authentication IP throttling is per process. Immutable uploaded files and old session records need a retention/garbage-collection policy for production. Exports should be checked with multilingual names and notes before production use. The test stay range is bounded to 366 nights and individual booking sizes are bounded for safe operation. These additional limits are implementation defaults, not text quoted from the workbook.

The default settlement currency is USD; supported settlement currencies use two decimal places. JPY is available for itinerary display, not payment settlement in this implementation. Changing the settlement currency after creating priced inventory is unsupported.

Do not mark mandatory release complete solely because local tests pass. Complete the account-backed checks and record the actual results before submitting the milestone.
