"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  changeStatus,
  createLead,
  login,
  logContact,
  saveDetails,
  saveNote,
  type ActionState,
} from "@/app/admin/actions";
import {
  CHANNELS,
  LOST_REASONS,
  SERVICES,
  STATUSES,
  TRANSITIONS,
  type Status,
} from "@/lib/leads/domain";
import { VEHICLE_OPTIONS } from "@/lib/site";
import { btnPrimary, btnSecondary, inputCls, labelCls } from "./ui";

const initial: ActionState = {};

function Submit({ children, className = btnPrimary }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Saving…" : children}
    </button>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs font-medium text-red-600">{msg}</p> : null;
}

function Banner({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.error}</p>;
  return null;
}

/* ---------- Login ---------- */

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(login, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Banner state={state} />
      <div>
        <label htmlFor="name" className={labelCls}>Your name</label>
        <input id="name" name="name" autoComplete="username" className={inputCls} aria-invalid={!!state.fields?.name} />
        <Err msg={state.fields?.name} />
      </div>
      <div>
        <label htmlFor="password" className={labelCls}>Desk password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className={inputCls} aria-invalid={!!state.fields?.password} />
        <Err msg={state.fields?.password} />
      </div>
      <Submit className={`${btnPrimary} w-full py-2.5`}>Sign in</Submit>
    </form>
  );
}

/* ---------- Contact buttons (log first response, then open dialer / WhatsApp) ---------- */

export function ContactButtons({ id, phone, waText }: { id: string; phone: string; waText: string }) {
  const [busy, setBusy] = useState(false);
  const go = async (via: "call" | "whatsapp") => {
    setBusy(true);
    const href = via === "call" ? `tel:${phone}` : `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(waText)}`;
    // Open first (user gesture), log in the background; logging must never block the call.
    if (via === "whatsapp") window.open(href, "_blank", "noopener");
    else window.location.href = href;
    try {
      await logContact(id, via);
    } catch (e) {
      console.error("[desk] could not log contact", e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" disabled={busy} onClick={() => go("call")} className="rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-navy-950 hover:bg-amber-300">
        Call
      </button>
      <button type="button" disabled={busy} onClick={() => go("whatsapp")} className="rounded-lg bg-[#0E7A3E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B6633]">
        WhatsApp
      </button>
    </div>
  );
}

/* ---------- Pipeline ---------- */

const ACTION_LABEL: Partial<Record<Status, string>> = {
  contacted: "Mark contacted",
  quoted: "Send / revise quote",
  booked: "Mark booked",
  completed: "Trip completed",
  lost: "Mark lost",
  cancelled: "Booking cancelled",
  new: "Reopen",
};

export function StatusActions({
  id,
  status,
  quotedAmount,
}: {
  id: string;
  status: Status;
  quotedAmount: number | null;
}) {
  const [state, action] = useFormState(changeStatus, initial);
  const [open, setOpen] = useState<Status | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) setOpen(null);
  }, [state]);
  const next = TRANSITIONS[status];
  if (!next.length) return <p className="text-sm text-slate-500">This lead is closed. No further steps.</p>;

  return (
    <div className="space-y-3">
      <Banner state={state} />
      <div className="flex flex-wrap gap-2">
        {next.map((to) => {
          const needsInput = to === "quoted" || to === "booked" || to === "lost";
          const tone = to === "booked" || to === "completed" ? btnPrimary : btnSecondary;
          if (needsInput) {
            return (
              <button key={to} type="button" onClick={() => setOpen(open === to ? null : to)} className={`${tone} ${open === to ? "ring-2 ring-amber-400" : ""}`}>
                {ACTION_LABEL[to] ?? STATUSES[to]}
              </button>
            );
          }
          return (
            <form key={to} action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="to" value={to} />
              <Submit className={tone}>{ACTION_LABEL[to] ?? STATUSES[to]}</Submit>
            </form>
          );
        })}
      </div>
      {open && (
        <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value={open} />
          {open === "quoted" && (
            <label className="min-w-[10rem] flex-1">
              <span className={labelCls}>Quoted fare (₹, total)</span>
              <input name="quotedAmount" inputMode="numeric" required defaultValue={quotedAmount ?? ""} className={inputCls} autoFocus />
            </label>
          )}
          {open === "booked" && (
            <label className="min-w-[10rem] flex-1">
              <span className={labelCls}>Booking value (₹, agreed fare)</span>
              <input name="bookingValue" inputMode="numeric" required defaultValue={quotedAmount ?? ""} className={inputCls} autoFocus />
            </label>
          )}
          {open === "lost" && (
            <label className="min-w-[12rem] flex-1">
              <span className={labelCls}>Why was it lost?</span>
              <select name="lostReason" required className={inputCls} defaultValue="">
                <option value="" disabled>Choose a reason</option>
                {LOST_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <Submit>Save</Submit>
        </form>
      )}
    </div>
  );
}

/* ---------- Details ---------- */

export type DetailValues = {
  id: string;
  name: string;
  pickup: string;
  drop: string;
  travelDate: string;
  travelTime: string;
  vehicle: string;
  passengers: string;
  assignedTo: string;
  followUpAt: string;
};

export function DetailsForm({ v }: { v: DetailValues }) {
  const [state, action] = useFormState(saveDetails, initial);
  const f = state.fields ?? {};
  const field = (name: keyof DetailValues, label: string, props: Record<string, unknown> = {}) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input name={name} defaultValue={v[name]} className={inputCls} aria-invalid={!!f[name]} {...props} />
      <Err msg={f[name]} />
    </label>
  );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={v.id} />
      <Banner state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", "Customer name")}
        {field("assignedTo", "Handled by", { placeholder: "Staff name" })}
        {field("pickup", "Pickup")}
        {field("drop", "Drop / destination")}
        {field("travelDate", "Travel date", { type: "date" })}
        {field("travelTime", "Pickup time", { type: "time" })}
        <label className="block">
          <span className={labelCls}>Vehicle</span>
          <select name="vehicle" defaultValue={v.vehicle} className={inputCls}>
            <option value="">Not decided</option>
            {[...new Set([...VEHICLE_OPTIONS, ...(v.vehicle ? [v.vehicle] : [])])].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        {field("passengers", "Passengers", { type: "number", min: 1, max: 200 })}
        <div className="sm:col-span-2">{field("followUpAt", "Follow up at (IST)", { type: "datetime-local" })}</div>
      </div>
      <div className="flex items-center gap-3">
        <Submit>Save details</Submit>
        {state.ok && <span className="text-sm text-green-700">Saved</span>}
      </div>
    </form>
  );
}

/* ---------- Notes ---------- */

export function NoteForm({ id }: { id: string }) {
  const [state, action] = useFormState(saveNote, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Banner state={state} />
      <textarea name="text" required rows={2} placeholder="e.g. Customer asked for an Innova instead; call back after 6 pm" className={inputCls} />
      <Submit className={btnSecondary}>Add note</Submit>
    </form>
  );
}

/* ---------- Manual lead (phone / WhatsApp / walk-in) ---------- */

export function ManualLeadForm() {
  const [state, action] = useFormState(createLead, initial);
  const f = state.fields ?? {};
  const sel = (name: string, label: string, options: Record<string, string>, def: string) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select name={name} defaultValue={def} className={inputCls}>
        {Object.entries(options).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
    </label>
  );
  const input = (name: string, label: string, props: Record<string, unknown> = {}) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input name={name} className={inputCls} aria-invalid={!!f[name]} {...props} />
      <Err msg={f[name]} />
    </label>
  );
  return (
    <form action={action} className="space-y-4">
      <Banner state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        {sel("channel", "Came in via", CHANNELS, "call")}
        {sel("service", "Trip type", SERVICES, "one_way")}
        {input("name", "Customer name", { required: true })}
        {input("phone", "Phone", { type: "tel", required: true, placeholder: "98400 12345" })}
        {input("pickup", "Pickup", { required: true })}
        {input("drop", "Drop / destination")}
        {input("travelDate", "Travel date", { type: "date" })}
        <label className="block">
          <span className={labelCls}>Vehicle</span>
          <select name="vehicle" defaultValue="" className={inputCls}>
            <option value="">Not decided</option>
            {VEHICLE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        {input("passengers", "Passengers", { type: "number", min: 1, max: 200 })}
        {input("source", "How did they hear about us?", { placeholder: "Google, repeat customer, friend…", list: "sources" })}
        <datalist id="sources">
          {["Google search", "Google Ads", "Facebook / Instagram", "Repeat customer", "Referral", "Justdial", "Corporate client"].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <label className="block">
        <span className={labelCls}>Notes</span>
        <textarea name="message" rows={3} className={inputCls} />
      </label>
      <Submit>Save lead</Submit>
    </form>
  );
}
