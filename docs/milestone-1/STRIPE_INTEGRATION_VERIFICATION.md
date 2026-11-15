# Stripe account-backed verification

Status on 15 November 2026: **prepared, not externally verified**. The student's Stripe account is being created. No sandbox secret key or listener signing secret is configured yet. The existing payment tests use fixtures and are not proof of Stripe account integration.

## Setup

1. Create/sign in to your Stripe account privately and select a sandbox/test environment. Use your real account details. Account creation and authentication remain student-controlled.
2. From the dashboard's API keys page, copy the sandbox **secret** key beginning `sk_test_` into `STRIPE_SECRET_KEY` in ignored `backend/.env`. Do not share it in chat/screenshots or commit it. The application's current adapter accepts `sk_test_` keys and rejects live keys. A publishable `pk_test_` key does not authenticate this backend. [Stripe API keys](https://docs.stripe.com/keys)
3. The verified Windows CLI v1.55.11 is installed outside Git. This machine's ignored environment file has `STRIPE_CLI_PATH` pointing to it. The release archive's SHA256 was checked against the official release's published digest; see `evidence/stripe-tooling.json`. Other machines must install the CLI from [Stripe's installation instructions](https://docs.stripe.com/cli/install) and set a local path or put it on PATH.
4. From `backend`, run `npm.cmd run check:stripe`. This makes a read-only sandbox authentication request and prints no balance or credentials. It does not establish payment/refund/webhook correctness.
5. Run `npm.cmd run stripe:listen` in a separate terminal. It passes the test key through the child process environment rather than command-line arguments, forwards the six required snapshot event types to the loopback HTTPS backend, and saves the signing secret directly into the ignored environment file. Arbitrary CLI lines, event bodies, keys and client secrets are not printed by the wrapper. Keep the listener running. The webhook signing secret is distinct from the API key. [Stripe local webhook forwarding](https://docs.stripe.com/webhooks#test-locally-without-a-registered-url)
6. Restart the backend so it reads both Stripe settings. Keep background jobs enabled for refund and expiration processing. The CLI's `--skip-verify` applies only to its forwarding request to the self-signed **localhost** endpoint; the API verification runner checks the actual local certificate explicitly.
7. Keep email bonuses disabled during this dedicated payment verification: the synthetic traveler address is not an actual inbox. SMTP/account-backed bonus testing is a separate task.

## Review and run

Preview the exact workflow without credentials, database access or external mutations:

```powershell
Set-Location backend
node scripts/verify-stripe.mjs --plan
```

Run the account-backed checks:

```powershell
npm.cmd run verify:stripe
```

The runner creates identifiable verification-only users/providers/flights/one room in `travel_platform`. Fixture providers/inventory and the fixture moderator are seeded directly through the application's schemas; the traveler registers through HTTP. They are synthetic system actors, not teammates. Every hold/payment/policy acceptance/cancellation goes through the running HTTP API. Payment confirmation uses Stripe's actual sandbox API with `pm_card_visa` and the decline test method; card numbers never pass through the backend. [Stripe test PaymentMethods](https://docs.stripe.com/testing#test-code)

It checks:

- Real sandbox authentication and test-mode resource association.
- A declined flight payment reaching the backend through Stripe's signed event, followed by retry using the same PaymentIntent.
- Successful flight payment, real signed event persistence, booking confirmation/reference and e-ticket.
- The original 75% cancellation tier: a USD 10 flight produces a USD 7.50 refund. Repeating cancellation must not duplicate the refund record.
- A second flight's provider cancellation: a USD 10 full refund.
- Hotel payment and cancellation: a USD 20 two-night stay produces a USD 15 tier refund.
- A separate unpaid hold reaches its real ten-minute deadline. The backend releases inventory and cancels the real sandbox PaymentIntent. No timestamp is shortened in Atlas to manufacture timeout evidence.

The full run normally waits for that actual ten-minute deadline. It polls in short intervals and prints progress every 30 seconds while waiting. Sandbox test transactions do not move real funds. [Stripe testing](https://docs.stripe.com/testing)

`node scripts/verify-stripe.mjs --quick` omits the timeout wait and records **partial_pass_expiry_pending**, not a complete pass. A later full invocation can complete the same run. `--new-run` explicitly starts another verification set; do not use it just because an external request was slow.

## Recovery and evidence

The private manifest at `backend/.local/stripe-run.json` stores generated fixture credentials and resource IDs so an interrupted run can reuse its records. It is ignored by Git. Fixtures are retained for inspection and are not silently deleted. If a required hold expires before its payment is confirmed, the runner must report the incomplete run; it does not revive inventory. Investigate before starting a new run.

The public evidence is `evidence/stripe-account-verification.json`. It retains only allowlisted stage outcomes, booking states and sandbox transaction/event/refund identifiers. It never records passwords, API keys, client secrets, cookies, raw error objects or request/response bodies. It is not a substitute for dashboard inspection and the student's review.

No direct `processEvent` call or locally fabricated webhook is used by this runner. A successful payment case requires an actual Stripe event ID present in the application's processed-event collection. A failed/missing listener, wrong signing secret, disabled jobs or wrong account must produce an incomplete result rather than a claimed pass.

The earlier replica-set tests still provide the evidence for additional financial edge cases: malformed signatures, replay/reordered events, wrong amounts/currencies, late-success compensation, refund failures and crash recovery. This account-backed run does not by itself repeat every one of those cases with actual Stripe services.
