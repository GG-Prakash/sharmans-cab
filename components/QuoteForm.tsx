"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { track } from "@/lib/track";
import { CITIES, TEL_HREF, VEHICLE_OPTIONS, whatsappHref } from "@/lib/site";
import TrackedLink from "./TrackedLink";
import { CheckIcon, PhoneIcon, WhatsAppIcon } from "./Icons";

type Fields = { pickup: string; drop: string; date: string; vehicle: string };
type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { pickup: "", drop: "", date: "", vehicle: "" };
const ORDER: (keyof Fields)[] = ["pickup", "drop", "date", "vehicle"];
const ENDPOINT = process.env.NEXT_PUBLIC_QUOTE_ENDPOINT;

function localToday() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function validate(f: Fields, today: string): Errors {
  const e: Errors = {};
  if (f.pickup.trim().length < 2) e.pickup = "Enter your pickup city";
  if (f.drop.trim().length < 2) e.drop = "Enter your drop location";
  if (!f.date) e.date = "Choose a travel date";
  else if (today && f.date < today) e.date = "Date can't be in the past";
  if (!f.vehicle) e.vehicle = "Select a vehicle type";
  return e;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const inputCls =
  "mt-1 block w-full rounded-lg border bg-white px-3 py-3 text-base text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400";

export default function QuoteForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [today, setToday] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => setToday(localToday()), []);
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  const set = (k: keyof Fields) => (v: string) => {
    setFields((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(fields, today);
    setErrors(errs);
    const first = ORDER.find((k) => errs[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus("submitting");
    track("form_submit", {
      pickup_city: fields.pickup.trim(),
      vehicle_type: fields.vehicle,
    });
    if (ENDPOINT) {
      try {
        await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(fields),
        });
      } catch {
        // WhatsApp handoff on the success screen still captures the lead.
      }
    }
    setStatus("success");
  }

  if (status === "success") {
    const msg =
      `Hi Sharman's Cab, please share a quote:\n` +
      `Pickup: ${fields.pickup.trim()}\nDrop: ${fields.drop.trim()}\n` +
      `Date: ${formatDate(fields.date)}\nVehicle: ${fields.vehicle}`;
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="focus:outline-none">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckIcon />
          </span>
          <h3 className="text-xl font-bold text-navy-900">Almost done!</h3>
        </div>
        <p className="mt-3 text-slate-600">
          Tap below to send these details on WhatsApp — we reply with your fare within minutes.
        </p>
        <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 rounded-lg bg-navy-50 p-4 text-sm">
          <dt className="text-slate-600">Pickup</dt>
          <dd className="font-medium text-navy-900">{fields.pickup}</dd>
          <dt className="text-slate-600">Drop</dt>
          <dd className="font-medium text-navy-900">{fields.drop}</dd>
          <dt className="text-slate-600">Date</dt>
          <dd className="font-medium text-navy-900">{formatDate(fields.date)}</dd>
          <dt className="text-slate-600">Vehicle</dt>
          <dd className="font-medium text-navy-900">{fields.vehicle}</dd>
        </dl>
        <TrackedLink
          href={whatsappHref(msg)}
          event="whatsapp_click"
          location="quote_success"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0E7A3E] px-4 py-3.5 text-base font-semibold text-white hover:bg-[#0B6633]"
        >
          <WhatsAppIcon /> Send on WhatsApp
        </TrackedLink>
        <TrackedLink
          href={TEL_HREF}
          event="call_click"
          location="quote_success"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-navy-200 px-4 py-3.5 text-base font-semibold text-navy-900 hover:bg-navy-50"
        >
          <PhoneIcon /> Or call us now
        </TrackedLink>
        <button
          type="button"
          onClick={() => {
            setFields(EMPTY);
            setStatus("idle");
          }}
          className="mt-4 w-full text-sm font-medium text-navy-600 underline underline-offset-2"
        >
          Start a new quote
        </button>
      </div>
    );
  }

  const field = (k: keyof Fields) => ({
    id: `q-${k}`,
    name: k,
    value: fields[k],
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `q-${k}-err` : undefined,
    className: `${inputCls} ${errors[k] ? "border-red-500" : "border-slate-300"}`,
  });

  const err = (k: keyof Fields) =>
    errors[k] ? (
      <p id={`q-${k}-err`} className="mt-1 text-sm text-red-600">
        {errors[k]}
      </p>
    ) : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="q-pickup" className="text-sm font-semibold text-navy-800">
          Pickup city
        </label>
        <input
          {...field("pickup")}
          list="q-cities"
          autoComplete="address-level2"
          placeholder="e.g. Chennai"
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
        <label htmlFor="q-drop" className="text-sm font-semibold text-navy-800">
          Drop location
        </label>
        <input
          {...field("drop")}
          list="q-cities"
          placeholder="e.g. Madurai, or airport"
          onChange={(e) => set("drop")(e.target.value)}
        />
        {err("drop")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="q-date" className="text-sm font-semibold text-navy-800">
            Travel date
          </label>
          <input
            {...field("date")}
            type="date"
            min={today || undefined}
            onChange={(e) => set("date")(e.target.value)}
          />
          {err("date")}
        </div>
        <div>
          <label htmlFor="q-vehicle" className="text-sm font-semibold text-navy-800">
            Vehicle
          </label>
          <select {...field("vehicle")} onChange={(e) => set("vehicle")(e.target.value)}>
            <option value="">Select</option>
            {VEHICLE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {err("vehicle")}
        </div>
      </div>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-lg bg-amber-400 px-4 py-3.5 text-base font-bold text-navy-950 shadow-sm hover:bg-amber-300 disabled:opacity-70"
      >
        {status === "submitting" ? "Sending…" : "Get my fare"}
      </button>
      <p className="text-center text-xs text-slate-500">No payment needed. Free, no-obligation quote.</p>
    </form>
  );
}
