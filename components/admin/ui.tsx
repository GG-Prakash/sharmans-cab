import type { ReactNode } from "react";
import { STATUSES, type Status } from "@/lib/leads/domain";

const STATUS_STYLE: Record<Status, string> = {
  new: "bg-amber-100 text-amber-900 ring-amber-300",
  contacted: "bg-sky-100 text-sky-900 ring-sky-300",
  quoted: "bg-violet-100 text-violet-900 ring-violet-300",
  booked: "bg-green-100 text-green-900 ring-green-300",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  lost: "bg-slate-100 text-slate-600 ring-slate-300",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-300",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUSES[status]}
    </span>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone = "default", hint }: { label: string; value: ReactNode; tone?: "default" | "alert"; hint?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "alert" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone === "alert" ? "text-red-700" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === "alert" ? "text-red-800" : "text-navy-900"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-400 aria-[invalid=true]:border-red-500";
export const labelCls = "text-xs font-semibold text-slate-600";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-slate-50 disabled:opacity-60";
