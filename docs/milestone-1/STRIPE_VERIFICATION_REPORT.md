# Real Stripe verification report

Full core run **passed** on 2026-11-15 (Africa/Cairo client date). This used the student's real Stripe sandbox account and Atlas application database. Sandbox transactions did not move real funds.

| Scenario | Verified result |
| --- | --- |
| API authentication | Actual sandbox credentials authenticated; runner enforces test-key and test-mode guards |
| Flight decline and retry | Real decline event reached the backend; retry reused the same PaymentIntent |
| Flight and hotel confirmation | Actual signed event IDs recorded; bookings confirmed; flight e-ticket available |
| Flight traveler cancellation | Booking Cancelled; actual Stripe refund succeeded: USD 7.50 |
| Flight provider cancellation | Booking Cancelled; actual Stripe refund succeeded: USD 10.00 |
| Hotel traveler cancellation | Booking Cancelled; actual Stripe refund succeeded: USD 15.00 |
| Repeated traveler cancellation | No duplicate refund record |
| Unpaid hold timeout | Real ten-minute deadline, booking Expired, inventory released, Stripe PaymentIntent canceled |

The verifier did not shorten hold timestamps, fabricate webhooks or call processEvent directly. Stripe API objects and processed real event IDs were checked. Backend HTTPS requests used its actual local certificate as the trust anchor.

Machine-readable receipts, including sandbox PaymentIntent/event/refund IDs for lookup in Stripe, are in [stripe-account-verification.json](evidence/stripe-account-verification.json). [stripe-readiness.json](evidence/stripe-readiness.json) records authentication and [live-api-readonly.json](evidence/live-api-readonly.json) records the separate post-run live checks. Credentials, card details, client secrets and cookies are not included.

The synthetic verification fixtures are retained for inspection in travel_platform. Their generated login credentials and the resume manifest are private in ignored backend/.local. They are application actors, not student contributors. The actual Git identity and solo/student review rules are unchanged.

The first launch reached the verifier before backend startup finished and stopped without creating fixtures. A readiness wait fixed this runner timing issue. The blank local CLI path was also restored. No production payment business rule was changed to obtain a pass.

Limits: this does not externally repeat every edge case. Account-backed fare changes, late-success compensation, refund-failure and restart scenarios retain their existing fixture evidence until separately exercised. SMTP delivery, GitHub publication/CI, final requirement acceptance and the student's own review remain pending.

For setup/reproduction, see [STRIPE_INTEGRATION_VERIFICATION.md](STRIPE_INTEGRATION_VERIFICATION.md). Keep the backend and local Stripe listener running for webhook-based demonstrations.
