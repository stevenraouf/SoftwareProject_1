"use client";
import { useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { api } from "@/lib/api";
import {
  ErrorLine,
  money,
  Status,
  Tiers,
  useAction,
  useLoad,
  type Policy,
} from "./shared";

interface Intent {
  clientSecret: string;
  paymentId: string;
  status: string;
  amount: number;
  currency: string;
}
const compiledKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripeInstances = new Map<string, ReturnType<typeof loadStripe>>();
function getStripe(key: string) {
  if (!key.startsWith("pk_test_")) return Promise.resolve(null);
  const existing = stripeInstances.get(key);
  if (existing) return existing;
  const instance = loadStripe(key);
  stripeInstances.set(key, instance);
  return instance;
}
function StripeForm({
  onSent,
  amount,
  currency,
}: {
  onSent: () => void;
  amount: number;
  currency: string;
}) {
  const stripe = useStripe(),
    elements = useElements(),
    action = useAction(),
    [ready, setReady] = useState(false),
    [loadError, failed] = useState("");
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(async () => {
          if (!stripe || !elements) return;
          const url = new URL(window.location.href);
          [
            "payment_intent",
            "payment_intent_client_secret",
            "redirect_status",
          ].forEach((k) => url.searchParams.delete(k));
          const response = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: url.toString() },
            redirect: "if_required",
          });
          if (response.error)
            throw new Error(
              response.error.message || "Payment was unsuccessful.",
            );
          onSent();
        });
      }}
    >
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={(event) =>
          failed(event.error.message || "Could not load Stripe payment fields.")
        }
      />
      <ErrorLine text={loadError || action.error} />
      <button
        className="button"
        disabled={action.busy || !stripe || !elements || !ready}
      >
        {action.busy ? "Contacting Stripe…" : "Pay " + money(amount, currency)}
      </button>
    </form>
  );
}
export function Checkout({
  id,
  type,
  currency,
  expires,
  existingPayment,
  onChanged,
}: {
  id: string;
  type: "flight" | "hotel" | "change";
  currency: string;
  expires: string;
  existingPayment?: string;
  onChanged: () => void;
}) {
  const [key, configureKey] = useState(
    compiledKey.startsWith("pk_test_") ? compiledKey : "",
  );
  useEffect(() => {
    const runtimeKey = window.aerisConfig?.stripePublic;
    if (runtimeKey !== undefined)
      configureKey(runtimeKey.startsWith("pk_test_") ? runtimeKey : "");
  }, []);
  const change = type === "change",
    base = change ? "/flight-changes/" + id : "/bookings/" + type + "/" + id,
    policy = useLoad<{ policies: Policy; acceptedAt: string | null }>(
      base + "/policies",
    );
  const [accepted, setAccepted] = useState(false),
    [acceptedAt, saveAcceptance] = useState(""),
    [intent, setIntent] = useState<Intent | null>(null),
    [pending, setPending] = useState(false),
    [now, time] = useState(() => Date.now()),
    [revision, refresh] = useState(0),
    action = useAction();
  const acceptance = policy.data?.acceptedAt || acceptedAt;
  const payment = useLoad<{ status: string }>(
    intent?.paymentId || existingPayment
      ? "/payments/" + (intent?.paymentId || existingPayment)
      : null,
    revision,
  );
  const left = Math.max(0, Math.ceil((Date.parse(expires) - now) / 1000));
  useEffect(() => {
    const timer = setInterval(() => time(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!left) onChanged();
  }, [left, onChanged]);
  useEffect(() => {
    if (!pending && !existingPayment && !intent) return;
    const timer = setInterval(() => refresh((n) => n + 1), 3500);
    return () => clearInterval(timer);
  }, [pending, existingPayment, intent]);
  const paymentState = payment.data?.status;
  useEffect(() => {
    if (paymentState === "Succeeded" || paymentState === "Cancelled")
      onChanged();
  }, [paymentState, onChanged]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("payment_intent_client_secret")) return;
    [
      "payment_intent",
      "payment_intent_client_secret",
      "redirect_status",
    ].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(window.history.state, "", url);
    setPending(true);
  }, []);
  if (!left)
    return (
      <div className="notice" role="status">
        Your hold has ended. Checking the latest booking status…
      </div>
    );
  return (
    <section className="panel stack">
      <div className="fare-row">
        <h2>{change ? "Replacement fare" : "Checkout"}</h2>
        <span>
          Hold remaining · {Math.floor(left / 60)}:
          {String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <Status state={policy} />
      {policy.data && (
        <>
          <Tiers tiers={policy.data.policies.cancellationTiers} />
          {policy.data.policies.segments?.map((s, i) => (
            <p key={s.flightId}>
              Leg {i + 1} · {s.cabin} · {s.freeBags} checked bags at{" "}
              {s.bagWeightKg} kg each · up to {s.maxExtraBags} extra at{" "}
              {money(s.extraBagPrice, currency)} each
            </p>
          ))}
          {policy.data.policies.checkInTime && (
            <p>
              Check-in {policy.data.policies.checkInTime} · Check-out{" "}
              {policy.data.policies.checkOutTime} ·{" "}
              {policy.data.policies.timezone}
            </p>
          )}
          {acceptance ? (
            <p role="status">
              Policies accepted {new Date(acceptance).toLocaleString()}.
            </p>
          ) : (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />{" "}
                I accept the provider’s policies and cancellation terms.
              </label>
              <button
                className="secondary"
                disabled={!accepted || action.busy}
                onClick={() =>
                  action.run(async () => {
                    const response = await api<{ acceptedAt: string }>(
                      base + "/accept-policies",
                      { method: "POST", body: { confirm: true } },
                    );
                    saveAcceptance(response.acceptedAt);
                  })
                }
              >
                Accept policies
              </button>
            </>
          )}
          {!key || !key.startsWith("pk_test_") ? (
            <p role="alert">
              Secure payment is unavailable. Configure the Stripe sandbox
              publishable key to open payment details.
            </p>
          ) : pending && paymentState !== "Failed" ? (
            <p role="status">
              Waiting for payment confirmation from the server…{" "}
              {paymentState || ""}
            </p>
          ) : intent && intent.status !== "succeeded" ? (
            <Elements
              key={intent.clientSecret}
              stripe={getStripe(key)}
              options={{
                clientSecret: intent.clientSecret,
                appearance: {
                  theme: "stripe",
                  variables: { colorPrimary: "#19364e", borderRadius: "10px" },
                },
              }}
            >
              <StripeForm
                amount={intent.amount}
                currency={intent.currency}
                onSent={() => {
                  setPending(true);
                  refresh((n) => n + 1);
                }}
              />
            </Elements>
          ) : (
            <button
              className="button"
              disabled={action.busy || !acceptance}
              onClick={() =>
                action.run(async () => {
                  const result = await api<Intent>(
                    existingPayment
                      ? "/payments/" + existingPayment + "/retry"
                      : change
                        ? base + "/payment"
                        : "/payments",
                    {
                      method: "POST",
                      body:
                        !existingPayment && !change
                          ? { bookingId: id, type }
                          : undefined,
                    },
                  );
                  setIntent(result);
                  setPending(
                    result.status === "succeeded" ||
                      result.status === "processing",
                  );
                })
              }
            >
              {existingPayment
                ? "Resume secure payment"
                : "Open secure payment"}
            </button>
          )}
        </>
      )}
      {pending && (
        <button className="secondary" onClick={onChanged}>
          Check booking status
        </button>
      )}
      <ErrorLine text={action.error || payment.error} />
    </section>
  );
}
