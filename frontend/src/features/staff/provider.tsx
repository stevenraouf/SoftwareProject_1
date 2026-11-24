"use client";

import { useState } from "react";
import { api, apiUrl } from "@/lib/api";
import {
  Action,
  Form,
  Problem,
  Section,
  useReferences,
  type Field,
  type Provider,
  type Tier,
} from "./ui";

type City = { city_id: string; name: string; country_code: string };
type EditorProps = { provider?: Provider; after: (updated: Provider) => void };
type ProviderType = "airline" | "hotel";

export function ProviderForm({
  type,
  provider,
  after,
}: EditorProps & { type: ProviderType }) {
  if (type === "hotel") return <HotelForm provider={provider} after={after} />;
  return (
    <Form
      fields={[
        {
          name: "name",
          label: "Airline name",
          maxLength: 100,
          initial: provider?.name,
        },
        {
          name: "code",
          label: "Airline code",
          pattern: "[A-Z0-9]{2,8}",
          placeholder: "2–8 capital letters or digits",
          initial: provider?.code,
        },
      ]}
      submit={provider ? "Save profile" : "Create airline"}
      reset={!provider}
      success={provider ? "Airline profile saved." : "Airline created."}
      onSubmit={async (values) => {
        const updated = await api<Provider>(
          "/airlines" + (provider ? "/" + provider._id : ""),
          {
            method: provider ? "PATCH" : "POST",
            body: { name: values.name, code: values.code.trim().toUpperCase() },
          },
        );
        after(updated);
      }}
    />
  );
}

function HotelForm({ provider, after }: EditorProps) {
  const cities = useReferences<City>("/cities");
  const fields: Field[] = [
    {
      name: "name",
      label: "Hotel name",
      maxLength: 150,
      initial: provider?.name,
    },
    {
      name: "address",
      label: "Street address",
      maxLength: 300,
      initial: provider?.address,
    },
    {
      name: "city",
      label: "City / country",
      options: cities.rows.map((c) => ({
        value: c.city_id,
        label: c.name + " · " + c.country_code,
      })),
      initial: provider?.city,
    },
    {
      name: "timezone",
      label: "Local time zone",
      initial: provider?.timezone || "Africa/Cairo",
    },
    {
      name: "starClass",
      label: "Star class",
      options: ["1", "2", "3", "4", "5"],
      initial: provider?.starClass,
    },
    {
      name: "amenities",
      label: "Amenities",
      optional: true,
      placeholder: "Wi-Fi, breakfast, pool",
      initial: provider?.amenities?.join(", "),
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      optional: true,
      maxLength: 10000,
      initial: provider?.description,
    },
  ];
  return (
    <>
      <Problem>{cities.error}</Problem>
      <Form
        fields={fields}
        submit={provider ? "Save profile" : "Create hotel"}
        reset={!provider}
        success={provider ? "Hotel profile saved." : "Hotel created."}
        onSubmit={async (v) => {
          const city = cities.rows.find((c) => c.city_id === v.city);
          if (!city) throw new Error("Select an official city and country.");
          const body = {
            ...v,
            country: city.country_code,
            starClass: Number(v.starClass),
            amenities: [
              ...new Set(
                v.amenities
                  .split(",")
                  .map((a) => a.trim())
                  .filter(Boolean),
              ),
            ],
          };
          const updated = await api<Provider>(
            "/hotels" + (provider ? "/" + provider._id : ""),
            { method: provider ? "PATCH" : "POST", body },
          );
          after(updated);
        }}
      />
    </>
  );
}

type ManagedProps = { provider: Provider; refresh: () => void };
export function ProviderMedia({ provider, refresh }: ManagedProps) {
  const hotel = provider.type === "hotel";
  const path = hotel
    ? "/hotels/" + provider._id + "/images"
    : "/airlines/" + provider._id + "/logo";
  const ids = hotel
    ? provider.imageIds || []
    : provider.logoId
      ? [provider.logoId]
      : [];
  const limit = hotel ? 5 : 1;
  return (
    <Section title={hotel ? "Property photos" : "Airline logo"}>
      <p>
        {ids.length} of {limit} {hotel ? "photos" : "logos"}
      </p>
      {ids.map((id, index) => (
        <div className="staffPhoto" key={id}>
          <img
            crossOrigin="use-credentials"
            src={apiUrl("/media/" + id)}
            alt={
              hotel ? "Property photo " + (index + 1) : "Current airline logo"
            }
          />
          <Action
            label="Remove image"
            confirmation="Remove this image from the provider profile?"
            act={async () => {
              await api(path + "/" + id, { method: "DELETE" });
              refresh();
            }}
          />
        </div>
      ))}
      {ids.length < limit && (
        <Form
          fields={[]}
          submit="Upload image"
          reset
          success="Image uploaded."
          onSubmit={async (_, data) => {
            const file = data.get("file");
            if (
              !(file instanceof File) ||
              !file.size ||
              file.size > 5 * 1024 * 1024 ||
              !["image/png", "image/jpeg"].includes(file.type)
            )
              throw new Error("Choose a JPEG or PNG up to 5 MB.");
            await api(path, { method: "POST", body: data });
            refresh();
          }}
        >
          <label className="field">
            JPEG or PNG, up to 5 MB
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png"
              required
            />
          </label>
        </Form>
      )}
    </Section>
  );
}

export function Policies({ provider, refresh }: ManagedProps) {
  const hotel = provider.type === "hotel";
  const [tiers, setTiers] = useState<Tier[]>(() =>
    (provider.cancellationTiers || []).map(({ threshold, refundPercent }) => ({
      threshold,
      refundPercent,
    })),
  );
  const fields: Field[] = hotel
    ? [
        {
          name: "checkInTime",
          label: "Check-in time",
          type: "time",
          initial: provider.checkInTime || "14:00",
        },
        {
          name: "checkOutTime",
          label: "Check-out time",
          type: "time",
          initial: provider.checkOutTime || "11:00",
        },
      ]
    : [];
  function setTier(index: number, field: keyof Tier, value: string) {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: Number(value) } : t)),
    );
  }
  return (
    <div className="stack">
      <Section title="Cancellation policy">
        <p>
          Set the minimum days before {hotel ? "check-in" : "departure"} for
          each refund. Existing bookings retain their accepted terms.
        </p>
        <Form
          fields={fields}
          submit="Save policy"
          success="Cancellation policy saved."
          onSubmit={async (values) => {
            if (new Set(tiers.map((t) => t.threshold)).size !== tiers.length)
              throw new Error(
                "Each cancellation tier needs a different minimum number of days.",
              );
            await api(
              hotel
                ? "/hotels/" + provider._id + "/policies"
                : "/airlines/" + provider._id + "/cancellation-policy",
              { method: "PUT", body: { ...values, tiers } },
            );
            refresh();
          }}
        >
          {tiers.map((tier, index) => (
            <div className="staffTier" key={index}>
              <label className="field">
                Minimum days
                <input
                  type="number"
                  value={tier.threshold}
                  min={0}
                  max={3650}
                  required
                  onChange={(e) => setTier(index, "threshold", e.target.value)}
                />
              </label>
              <label className="field">
                Refund %
                <input
                  type="number"
                  value={tier.refundPercent}
                  min={0}
                  max={100}
                  step=".01"
                  required
                  onChange={(e) =>
                    setTier(index, "refundPercent", e.target.value)
                  }
                />
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setTiers((prev) => prev.filter((_, i) => i !== index))
                }
              >
                Remove tier {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={tiers.length >= 30}
            onClick={() =>
              setTiers((prev) => [...prev, { threshold: 0, refundPercent: 0 }])
            }
          >
            Add refund tier
          </button>
        </Form>
      </Section>
      {!hotel && (
        <Section title="Extra baggage">
          <Form
            fields={[
              {
                name: "extraBagPrice",
                label: "Price per extra bag (USD)",
                type: "number",
                min: 0.01,
                step: ".01",
                initial: provider.extraBagPrice || undefined,
              },
              {
                name: "maxExtraBags",
                label: "Maximum extra bags per passenger",
                type: "number",
                min: 0,
                max: 20,
                initial: provider.maxExtraBags || 0,
              },
            ]}
            submit="Save baggage rules"
            success="Baggage rules saved."
            onSubmit={async (values) => {
              await api("/airlines/" + provider._id + "/baggage-policy", {
                method: "PUT",
                body: {
                  extraBagPrice: Number(values.extraBagPrice),
                  maxExtraBags: Number(values.maxExtraBags),
                },
              });
              refresh();
            }}
          />
        </Section>
      )}
    </div>
  );
}
