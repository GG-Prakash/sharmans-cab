"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { track } from "@/lib/track";
import { getAttribution } from "@/lib/attribution";
import { BUSINESS, CITIES, TEL_HREF, TRIP_TYPES, VEHICLE_OPTIONS, whatsappHref } from "@/lib/site";
import type { Service } from "@/lib/leads/domain";
import TrackedLink from "./TrackedLink";
import { CheckIcon, PhoneIcon, WhatsAppIcon } from "./Icons";

type Fields = {
  service: Service;
  pickup: string;
  drop: string;
  travelDate: string;
  travelTime: string;
  vehicle: string;
  passengers: string;
  name: string;
  phone: string;
  website: string; // honeypot
};
type Key = keyof Fields;
type Errors = Partial<Record<Key | "form", string>>;

const EMPTY: Fields = {
  service: "one_way",
  pickup: "",
  drop: "",
  travelDate: "",
  travelTime: "",
  vehicle: "",
  passengers: "",
  name: "",
  phone: "",
  website: "",
};
// Fields that render their own error message, in on-screen order.
const ORDER: Key[] = ["pickup", "drop", "travelDate", "travelTime", "passengers", "name", "phone"];

function localToday() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Mirrors the server rules for instant feedback. The server stays the authority.
function validate(f: Fields, today: string): Errors {
  const e: Errors = {};
  const trip = TRIP_TYPES.find((t) => t.service === f.service)!;
  if (f.pickup.trim().length < 2) e.pickup = "Enter your pickup location";
  if (trip.needsDrop && f.drop.trim().length < 2) e.drop = `Enter your ${trip.dropLabel.toLowerCase()}`;
  if (!f.travelDate) e.travelDate = "Choose a travel date";
  else if (today && f.travelDate < today) e.travelDate = "Date can't be in the past";
  if (f.service === "bus_group" && !(Number(f.passengers) > 0)) e.passengers = "How many passengers?";
  if (f.name.trim().length < 2) e.name = "Enter your name";
  const digits = f.phone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^[2-9]\d{9}$/.test(digits)) e.phone = "Enter a valid 10-digit mobile number";
  return e;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function summaryLines(f: Fields) {
  const trip = TRIP_TYPES.find((t) => t.service === f.service)!;
  return [
    `Trip: ${trip.label}`,
    `Pickup: ${f.pickup.trim()}`,
    f.drop.trim() ? `${trip.dropLabel.replace(" (optional)", "")}: ${f.drop.trim()}` : "",
    `Date: ${formatDate(f.travelDate)}${f.travelTime ? `, ${f.travelTime}` : ""}`,
    f.vehicle ? `Vehicle: ${f.vehicle}` : "",
    f.passengers ? `Passengers: ${f.passengers}` : "",
    `Name: ${f.name.trim()}`,
  ].filter(Boolean);
}

const inputCls =
  "mt-1 block w-full rounded-lg border bg-white px-3 py-3 text-base text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";

type Status = "idle" | "submitting" | "success" | "error";

export default function QuoteForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [ref, setRef] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const keyRef = useRef<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => setToday(localToday()), []);
  useEffect(() => {
    if (status === "success" || status === "error") resultRef.current?.focus();
  }, [status]);

  const trip = TRIP_TYPES.find((t) => t.service === fields.service)!;

  const set = (k: Key) => (v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit() {
    // One idempotency key per filled-in form: retries and double taps can't create duplicates.
    if (!keyRef.current) keyRef.current = newKey();
    setStatus("submitting");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...fields,
          drop: fields.drop || null,
          travelTime: fields.travelTime || null,
          vehicle: fields.vehicle || null,
          passengers: fields.passengers ? Number(fields.passengers) : null,
          attribution: getAttribution(),
          idempotencyKey: keyRef.current,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ref?: string;
        outcome?: string;
        fields?: Errors;
        error?: string;
      };
      if (res.status === 422 && data.fields) {
        const first = ORDER.find((k) => data.fields?.[k]);
        // A rejection on a field with no on-screen message must still be visible, or the button looks dead.
        setErrors(first ? data.fields : { form: data.error || "Please check your details and try again." });
        setStatus("idle");
        if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
        return;
      }
      if (!res.ok || !data.ok || !data.ref) throw new Error(data.error || `HTTP ${res.status}`);
      setRef(data.ref);
      setStatus("success");
      // Count a conversion for a newly stored lead. "retry" means the server stored it on an earlier
      // attempt whose response never reached us, so this is the first success the visitor sees.
      // "duplicate" (same trip already open) is not a new lead.
      if (data.outcome === "created" || data.outcome === "retry") {
        track("form_submit", { lead_ref: data.ref, service: fields.service, vehicle_type: fields.vehicle || "any" });
      }
    } catch {
      setStatus("error");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    const errs = validate(fields, today);
    setErrors(errs);
    const first = ORDER.find((k) => errs[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    void submit();
  }

  function reset() {
    setFields(EMPTY);
    setErrors({});
    setRef(null);
    keyRef.current = "";
    setStatus("idle");
  }

  if (status === "success" && ref) {
    const msg = [`Hi Sharman's Cab, my quote request ${ref}:`, ...summaryLines(fields)].join("\n");
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="focus:outline-none">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckIcon />
          </span>
          <div>
            <h3 className="text-xl font-bold text-navy-900">Request received</h3>
            <p className="text-sm text-slate-600">
              Reference <span className="font-mono font-semibold text-navy-900">{ref}</span>
            </p>
          </div>
        </div>
        <p className="mt-3 text-slate-600">
          Our booking desk will call you on <span className="font-semibold text-navy-900">{fields.phone}</span> to
          confirm your fare with you. Need it faster? Message us now.
        </p>
        <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 rounded-lg bg-navy-50 p-4 text-sm">
          {summaryLines(fields).map((line) => {
            const [k, ...v] = line.split(": ");
            return (
              <div key={k} className="contents">
                <dt className="text-slate-600">{k}</dt>
                <dd className="font-medium text-navy-900">{v.join(": ")}</dd>
              </div>
            );
          })}
        </dl>
        <TrackedLink
          href={whatsappHref(msg)}
          event="whatsapp_click"
          location="quote_success"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E7A3E] px-4 py-3.5 text-base font-semibold text-white hover:bg-[#0B6633]"
        >
          <WhatsAppIcon /> Chat on WhatsApp
        </TrackedLink>
        <button
          type="button"
          onClick={reset}
          className="mt-4 w-full text-sm font-medium text-navy-600 underline underline-offset-2"
        >
          Start a new quote
        </button>
      </div>
    );
  }

  if (status === "error") {
    const msg = ["Hi Sharman's Cab, please share a quote:", ...summaryLines(fields), `Phone: ${fields.phone}`].join("\n");
    return (
      <div ref={resultRef} tabIndex={-1} role="alert" className="focus:outline-none">
        <h3 className="text-xl font-bold text-navy-900">We couldn&apos;t send that</h3>
        <p className="mt-2 text-slate-600">
          Your details are ready below. Send them on WhatsApp or call us, and we&apos;ll quote right away.
        </p>
        <TrackedLink
          href={whatsappHref(msg)}
          event="whatsapp_click"
          location="quote_error"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E7A3E] px-4 py-3.5 text-base font-semibold text-white hover:bg-[#0B6633]"
        >
          <WhatsAppIcon /> Send details on WhatsApp
        </TrackedLink>
        <TrackedLink
          href={TEL_HREF}
          event="call_click"
          location="quote_error"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-navy-200 px-4 py-3.5 text-base font-semibold text-navy-900 hover:bg-navy-50"
        >
          <PhoneIcon /> Call {BUSINESS.phoneDisplay}
        </TrackedLink>
        <button
          type="button"
          onClick={() => void submit()}
          className="mt-4 w-full text-sm font-medium text-navy-600 underline underline-offset-2"
        >
          Try sending again
        </button>
      </div>
    );
  }

  const field = (k: Key) => ({
    id: `q-${k}`,
    name: k,
    value: fields[k],
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `q-${k}-err` : undefined,
    className: `${inputCls} ${errors[k] ? "border-red-500" : "border-slate-300"}`,
  });
  const err = (k: Key) =>
    errors[k] ? (
      <p id={`q-${k}-err`} className="mt-1 text-sm text-red-600">
        {errors[k]}
      </p>
    ) : null;
  const label = "text-sm font-semibold text-navy-800";

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <fieldset>
        <legend className={label}>Trip type</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {TRIP_TYPES.map((t) => (
            <label
              key={t.service}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400 ${
                fields.service === t.service
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-slate-300 text-navy-800 hover:border-navy-600"
              }`}
            >
              <input
                type="radio"
                name="service"
                value={t.service}
                checked={fields.service === t.service}
                onChange={() => {
                  set("service")(t.service);
                  setErrors({});
                }}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="q-pickup" className={label}>
            Pickup
          </label>
          <input
            {...field("pickup")}
            list="q-cities"
            autoComplete="address-level2"
            placeholder={fields.service === "airport" ? "e.g. Chennai Airport or T. Nagar" : "e.g. Chennai"}
            onChange={(e) => set("pickup")(e.target.value)}
          />
          <datalist id="q-cities">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {err("pickup")}
        </div>
        <div>
          <label htmlFor="q-drop" className={label}>
            {trip.dropLabel}
          </label>
          <input
            {...field("drop")}
            list="q-cities"
            placeholder={fields.service === "airport" ? "e.g. Chennai Airport" : "e.g. Madurai"}
            onChange={(e) => set("drop")(e.target.value)}
          />
          {err("drop")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="q-travelDate" className={label}>
            Travel date
          </label>
          <input
            {...field("travelDate")}
            type="date"
            min={today || undefined}
            onChange={(e) => set("travelDate")(e.target.value)}
          />
          {err("travelDate")}
        </div>
        <div>
          <label htmlFor="q-travelTime" className={label}>
            Pickup time <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input {...field("travelTime")} type="time" onChange={(e) => set("travelTime")(e.target.value)} />
          {err("travelTime")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="q-vehicle" className={label}>
            Vehicle
          </label>
          <select {...field("vehicle")} onChange={(e) => set("vehicle")(e.target.value)}>
            <option value="">Not sure</option>
            {VEHICLE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="q-passengers" className={label}>
            Passengers{" "}
            {fields.service !== "bus_group" && <span className="font-normal text-slate-500">(optional)</span>}
          </label>
          <input
            {...field("passengers")}
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            onChange={(e) => set("passengers")(e.target.value)}
          />
          {err("passengers")}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="q-name" className={label}>
            Your name
          </label>
          <input {...field("name")} autoComplete="name" onChange={(e) => set("name")(e.target.value)} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="q-phone" className={label}>
            Mobile number
          </label>
          <input
            {...field("phone")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98400 12345"
            onChange={(e) => set("phone")(e.target.value)}
          />
          {err("phone")}
        </div>
      </div>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={fields.website}
            onChange={(e) => set("website")(e.target.value)}
          />
        </label>
      </div>

      {errors.form && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {errors.form}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-lg bg-amber-400 px-4 py-3.5 text-base font-bold text-navy-950 shadow-sm hover:bg-amber-300 disabled:opacity-70"
      >
        {status === "submitting" ? "Sending…" : "Get my fare"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Free, no-obligation quote. We use your number only to reply about this trip.{" "}
        <a href="/privacy" className="underline underline-offset-2">
          Privacy
        </a>
      </p>
    </form>
  );
}
