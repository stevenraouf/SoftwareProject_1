# Engineering review and verification

## Current acceptance state

The backend has a passing local verification baseline. It is not an exhaustive acceptance certificate. A follow-up [coverage audit](COVERAGE_AUDIT.md) found and corrected additional conformance issues. **The submission release gate remains open**: Atlas connectivity, account-backed Stripe payments/refunds, actual SMTP delivery, and the sole student's own recorded review remain pending. Milestone 2 UI work is separate.

This is an AI-assisted engineering self-review. There is one human student/developer. No student approval, additional team member, GitHub publication or instructor acceptance is invented. The [policy record](AI_POLICY_AND_SOLO_SUBMISSION.md) distinguishes AI checks from the student's own review; a second teammate is not a prerequisite imposed by this repository.

## Executed evidence

| Check | Result | Evidence / limits |
| --- | --- | --- |
| TypeScript | Passed | `npm.cmd run typecheck`; strict compiler configuration |
| ESLint | Passed | `npm.cmd run lint`; unused-code and recommended TypeScript rules |
| Compiled backend | Passed | `npm.cmd run build`; native ES modules on Node 22.14.0 |
| Fresh checkout / install | Passed | `clean-checkout.json`; separate clone, fresh node_modules, npm ci, type checking, lint, 46 tests, and build |
| Unit/integration suite | **46 passed, 0 failed**, two suites | `test-results.json`; six unit scenarios and 40 HTTP/replica-set scenarios |
| Transaction behavior | Passed locally | Real disposable MongoDB 8.2.6 replica set; no mocked database for inventory checks |
| Local TLS certificate | Generated successfully | Ignored `.certs/` files; self-signed localhost certificate |
| Compiled HTTPS smoke | **Five checks passed** | `https-smoke.json`; actual HTTPS requests, Swagger HTML/JavaScript, secure cookies, CSRF and real FX fetch/cache |
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
| MongoDB Atlas | Configure the user's project, database user and IP access; run `npm.cmd run check:atlas` from `backend`, then seed/start against the intended Atlas database. The checker alone does not verify writes or indexes. |
| Stripe test account | Run a real PaymentIntent through the signed listener, verify confirmation, expiry/cancellation, and a real test refund |
| SMTP test inbox | Enable email bonuses with configured SMTP and observe verification/reset/invitation/notification delivery |
| GitHub | Connect the user's repository and push genuine commits; CI has been authored but not run by GitHub |
| Sole student's human review | Review the actual source/version and perform the walkthrough using the solo discussion guide; record the real date/findings. No additional teammate or prior approval is invented |
| Browser and frontend | A browser visual/accessibility review and all Next.js/UI requirements are still Milestone 2 work; HTTPS smoke is not browser interaction |

## Operational limits to retain in review

Search/analytics assemble candidate results in memory and have not been load-tested. Authentication IP throttling is per process. Immutable uploaded files and old session records need a retention/garbage-collection policy for production. Exports should be checked with multilingual names and notes before production use. The test stay range is bounded to 366 nights and individual booking sizes are bounded for safe operation. These additional limits are implementation defaults, not text quoted from the workbook.

The default settlement currency is USD; supported settlement currencies use two decimal places. JPY is available for itinerary display, not payment settlement in this implementation. Changing the settlement currency after creating priced inventory is unsupported.

Do not mark mandatory release complete solely because local tests pass. Complete the account-backed checks and record the actual results before submitting the milestone.
