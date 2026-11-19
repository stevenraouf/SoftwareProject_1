# Engineering review and verification

## Current acceptance state

The 19 November release audit passed 57 tests, all 148 API operation workflows, clean installation/build checks on Node 22.23.5, actual core Stripe/Atlas payment/refund/ten-minute-expiry checks and all 11 live bonus checks. Actual SMTP delivery uses a local development test inbox. See [submission readiness](SUBMISSION_READINESS.md) and [bonus evidence](BONUS_VERIFICATION.md). **The release gate remains open:** the sole student reported that personal review is not complete and earlier credential rotation is uncertain. Release merges and course acceptance remain pending. No exhaustive acceptance certificate or student approval is inferred. Milestone 2 UI work is separate.

This is an AI-assisted engineering self-review. There is one human student/developer. No student approval, additional team member, GitHub publication or instructor acceptance is invented. The [policy record](AI_POLICY_AND_SOLO_SUBMISSION.md) distinguishes AI checks from the student's own review; a second teammate is not a prerequisite imposed by this repository.

On 14 November 2026, the API audit expanded the suite from 46 to 56 passing tests and measured successful HTTP workflows for all 147 documented operations. The global permission matrix passed 120 anonymous, 100 wrong-role and 86 missing-CSRF checks. See [the API test report](API_TEST_REPORT.md). These workflows use an isolated real replica set and fixture Stripe/SMTP adapters; the live Atlas application was checked separately with 11 public GET requests. Operation coverage is not exhaustive requirement acceptance.

## Executed evidence

### Final submission audit on 19 November 2026

The complete suite now passes **57 tests and 148/148 operation workflows**, including a new GEN-11 regression and the usable emailed password-reset form. A new, secret-free source copy passed fresh dependency installation, compiler/lint/tests/build and compiled HTTPS/FX checks. These checks passed again on patched **Node 22.23.5** with explicit local-certificate verification; see [clean-install evidence](evidence/clean-install-2026-11-19.json).

The real core Stripe/Atlas verifier completed a fresh, unshortened ten-minute expiry run successfully. The additional [bonus verifier](BONUS_VERIFICATION.md) passed all 11 workbook bonuses using actual Atlas, Stripe sandbox objects and SMTP delivery to a local test inbox. The exported one-page itinerary PDF was rendered and visually inspected. The original workbook/PDF are unchanged, reference JSON matches the official remote workbook, and source/privacy checks passed. The current local launcher uses the patched runtime and enables the loopback-only SMTP test-inbox profile.

Important findings corrected: unpaid provider-invalidated holds now stay Pending Payment until their original deadline while releasing inventory once; the recovery email now has a working single-use link/form; both token query fields are documented in Swagger; the Stripe verifier handles standard Atlas URIs. A local forwarding interruption was recovered through official Stripe event redelivery, and the successful bonus rerun is recorded. No local success signature/event was fabricated. Additional rare external-service permutations remain representative fixture tests, not an exhaustive external certification.

The student reported their own review is not complete and is unsure whether earlier disclosed passwords were rotated. Both remain actual student actions in [submission readiness](SUBMISSION_READINESS.md); no approval, waiver or historical review date is invented.

Application commit `1ac0130` was published and [GitHub-hosted run 44598887393](https://github.com/stevenraouf/SoftwareProject_1/actions/runs/44598887393) passed fresh installation, typecheck, lint, tests, build and production audit on pinned Node 22.23.5. Existing `main`/`develop` histories are now published, with [draft PR 1](https://github.com/stevenraouf/SoftwareProject_1/pull/1) left open for the sole student's review. No release merge was performed. Later handover-only commits retain the explicit application-commit scope in `evidence/github-ci.json`.

### Local startup correction on 19 November 2026

Windows last booted on 19 November at 19:04 Africa/Cairo, after the prior server run. No application process or listener on port 3443 remained, explaining `ERR_CONNECTION_REFUSED`. Atlas authentication and an aborted read-only transaction still passed. Added `START_SWAGGER.cmd`, `npm.cmd run start:local` and the VS Code **Start Travel API (Swagger)** task. The shared launcher resolves the backend directory, checks configuration/certificates, builds before a cold start and reuses an already healthy server. It reports an unrelated occupied port without killing that service.

Cold build/start, certificate-verified health, both npm/batch reuse paths, unrelated-port handling and all **11 live HTTPS GET checks** passed. The application was restarted in the background. After a Windows reboot, the student can run the launcher or VS Code task; no automatic Windows service was installed. See [startup evidence](evidence/local-startup-2026-11-19.json). Application business logic and secrets were unchanged; the complete 56-test/147-operation rerun remains dated 17 November.

### API rerun on 17 November 2026

At the student's request, reran `npm.cmd run test:api` against a disposable real MongoDB 8.2.6 replica set on D:. Both suites passed: **56 tests, 0 failures, 0 skipped tests**, with successful HTTP workflows for **147/147 documented operations**. The permission matrix passed **120 anonymous**, **100 incorrect-role**, and **86 missing-CSRF** checks. The coverage list exactly matches the generated OpenAPI method/path list.

`npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build` passed. Separate checks passed for Atlas authentication/ping/an aborted read-only transaction, all **11 live certificate-verified HTTPS GET checks**, and real Stripe sandbox API authentication. The payment/refund/ten-minute-expiry run was not repeated; its evidence remains dated 15 November. The complete workflow suite uses Stripe/SMTP fixtures, and actual SMTP delivery remains unverified. This rerun does not constitute a manual Swagger click-through or the sole student's approval.

The coverage observer previously hardcoded the 14 November date. It now records the supplied client date (or the Africa/Cairo date) and execution timestamp. The report generator also identifies automated HTTP testing explicitly. No application business logic was changed for this rerun. See [dated rerun evidence](evidence/api-verification-2026-11-17.json) and the regenerated [operation-by-operation API report](API_TEST_REPORT.md).

| Check | Result | Evidence / limits |
| --- | --- | --- |
| TypeScript | Passed | `npm.cmd run typecheck`; strict compiler configuration |
| ESLint | Passed | `npm.cmd run lint`; unused-code and recommended TypeScript rules |
| Compiled backend | Passed | `npm.cmd run build`; native ES modules on Node 22.23.5 |
| Fresh checkout / install | Passed | `clean-checkout.json`; separate clone, fresh node_modules, npm ci, type checking, lint, 46 tests, and build |
| Unit/integration suite | **57 passed, 0 failed**, two suites | Latest: `evidence/api-test-results.json`; six unit and 51 HTTP/replica-set scenarios. `test-results.json` preserves the earlier 46-test baseline. |
| Complete API operation coverage | **148/148 successful workflows** | `evidence/api-route-coverage.json`, observed from completed HTTP requests; gate rejects an untested documented operation. 120 anonymous/100 incorrect-role/86 missing-CSRF checks passed. |
| Running Atlas-backed API | **11 public GET checks passed** | `evidence/live-api-readonly.json`; verified local TLS certificate, health/database connectivity, four reference lists, currencies, posts/public itinerary search, Swagger assets and response-specific OpenAPI examples. No credentials, cookies or body data retained. |
| VS Code browser inspection | Passed, limited scope | Swagger rendered in the user's VS Code browser; navigated to public health and observed database=true, then restored Swagger. This did not click through all 147 operations or constitute the student's review. |
| Transaction behavior | Passed locally | Real disposable MongoDB 8.2.6 replica set; no mocked database for inventory checks |
| Live MongoDB Atlas connection | Passed, limited scope | 13 November 2026: `npm.cmd run check:atlas --prefix backend` exited 0; authentication/ping and a read-only snapshot transaction succeeded. Transaction was aborted; no data written. Does not establish write permissions, indexes, seed or application startup. |
| Atlas application setup | Passed, limited scope | `evidence/atlas-setup.json`: fresh build, 28 models/indexes initialized; 8 each of official countries/cities/airports/attractions preserved; reference and user-configured administrator seeds repeated without duplicate records. Compiled `createApp`, `seedReference` and `seedAdmin` were exercised directly. |
| Atlas HTTPS/authentication | Passed | Certificate-verified loopback HTTPS: health/countries/Swagger 200; admin login 201; secure HttpOnly access/refresh cookies; authenticated me 200; missing-CSRF mutation rejected 403; logout 201; revoked session rejected 401. Verification session revoked; no bookings/payments/email created. |
| Local TLS certificate | Generated successfully | Ignored `.certs/` files; self-signed localhost certificate |
| Compiled HTTPS smoke | **Five checks passed** | `https-smoke.json`; actual HTTPS requests, Swagger HTML/JavaScript, secure cookies, CSRF and real FX fetch/cache |
| Account-backed Stripe sandbox and Atlas | **Full core run repeated, 19 November** | `evidence/stripe-account-verification.json`: real declined payment/retry, real signed-event IDs, flight/hotel confirmation, $7.50 traveler flight refund, $10 full provider refund, $15 hotel refund, actual ten-minute unpaid hold expiry, Stripe cancellation and released inventory. No mock or locally fabricated webhook in this run. |
| GitHub publication and CI | **Passed for application commit 1ac0130** | Published genuine review-branch history; GitHub-hosted fresh npm ci, typecheck, lint, tests, build and production audit all passed. `evidence/github-ci.json` records the commit/run URL. Documentation-only follow-ups retain that explicit application-commit scope. |
| Swagger/OpenAPI | Exported | 147 operations across 123 paths; source-derived role/access and requirement metadata |
| Source traceability | Generated | All 115 workbook rows; 104 mandatory and 11 bonuses; source text preserved |
| Official seed | Passed locally and repeated | Eight airports, attractions, cities and countries; unique identifiers preserved |
| Real FXRatesAPI | Passed | Backend fetched/cached the service's actual response; observed rate date recorded in HTTPS report |
| Production dependency audit | See JSON evidence | `production-dependency-audit.json`; expected zero reported production advisories at this verification |
| Development dependency audit | **Zero reported vulnerabilities on 19 November** | Fresh `npm audit --json`; see `dependency-audit.json`. Earlier low-severity results remain historical evidence rather than the current registry result. |

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
| Stripe test account | Full core sandbox verification repeated successfully on 19 November. Actual higher/lower-fare Stripe changes also passed. Additional late-success, refund-failure and restart permutations retain representative fixture evidence. See `STRIPE_VERIFICATION_REPORT.md`. |
| SMTP test inbox | Actual local SMTP test-inbox delivery passed 19 November; personal/internet mailbox delivery was not tested |
| GitHub | Review branch published; actual CI passed for application commit `1ac0130` on 19 November. Release merges await the student's recorded review; no approval is invented. |
| Sole student's human review | Review the actual source/version and perform the walkthrough using the solo discussion guide; record the real date/findings. No additional teammate or prior approval is invented |
| Browser and frontend | Swagger rendering and public live-health navigation were checked in VS Code. Full browser workflow/accessibility review and all Next.js/UI requirements remain separate; automated HTTPS workflows are not 147 manual UI interactions. |

## Operational limits to retain in review

Search/analytics assemble candidate results in memory and have not been load-tested. Authentication IP throttling is per process. Immutable uploaded files and old session records need a retention/garbage-collection policy for production. Exports should be checked with multilingual names and notes before production use. The test stay range is bounded to 366 nights and individual booking sizes are bounded for safe operation. These additional limits are implementation defaults, not text quoted from the workbook.

The default settlement currency is USD; supported settlement currencies use two decimal places. JPY is available for itinerary display, not payment settlement in this implementation. Changing the settlement currency after creating priced inventory is unsupported.

Do not mark mandatory release complete solely because local tests pass. Complete the account-backed checks and record the actual results before submitting the milestone.
