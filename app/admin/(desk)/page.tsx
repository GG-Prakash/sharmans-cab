import Link from "next/link";
import { getMetrics, listLeads } from "@/lib/leads/repo";
import { SERVICES, formatPhone, rupees, type Service, type Status } from "@/lib/leads/domain";
import { fmtDate, fmtDateTime, minutesSince, timeAgo } from "@/lib/format";
import { SampleBadge, Stat, StatusBadge, inputCls } from "@/components/admin/ui";
import { countSampleLeads } from "@/lib/leads/samples";
import { removeSamples, resetSamples } from "@/app/admin/actions";
import { PREVIEW } from "@/lib/site";

export const dynamic = "force-dynamic";

const VIEWS: { key: string; label: string }[] = [
  { key: "due", label: "Needs action" },
  { key: "open", label: "All open" },
  { key: "booked", label: "Booked" },
  { key: "completed", label: "Completed" },
  { key: "lost", label: "Lost" },
  { key: "all", label: "Everything" },
];
const PAGE = 50;

export default async function Inbox({
  searchParams,
}: {
  searchParams: { view?: string; q?: string; service?: string; page?: string };
}) {
  const view = VIEWS.some((v) => v.key === searchParams.view) ? searchParams.view! : "due";
  // A repeated ?q= arrives as an array at runtime; only a single string is a search.
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const service = (searchParams.service && searchParams.service in SERVICES ? searchParams.service : "") as Service | "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const [{ leads, total }, m, samples] = await Promise.all([
    listLeads({ view: view as "due", q, service, limit: PAGE, offset: (page - 1) * PAGE }),
    getMetrics(30),
    countSampleLeads(),
  ]);
  const qs = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, q, service, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/admin?${p}`;
  };
  const now = Date.now();

  return (
    <div className="space-y-5">
      {(PREVIEW || samples > 0) && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-700">
            {samples > 0 ? (
              <>
                <span className="font-semibold text-navy-900">{samples} sample leads</span> are loaded so the desk and
                reports have something to show. They&apos;re marked <SampleBadge /> and never sent to Google Ads.
              </>
            ) : (
              "No sample leads loaded. Only real enquiries are shown."
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            <form action={resetSamples}>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-navy-900 hover:bg-slate-50">
                {samples > 0 ? "Reset samples" : "Load samples"}
              </button>
            </form>
            {samples > 0 && (
              <form action={removeSamples}>
                <button className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">
                  Remove samples
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New, waiting > 15 min" value={m.overdueNew} tone={m.overdueNew ? "alert" : "default"} hint="Call these first" />
        <Stat label="Follow-ups due" value={m.followUpsDue} tone={m.followUpsDue ? "alert" : "default"} />
        <Stat label="Bookings · 30 days" value={m.booked} hint={`${m.leads} leads`} />
        <Stat label="Booked value · 30 days" value={rupees(m.bookingValue)} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={qs({ view: v.key, page: undefined })}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold ${
                v.key === view ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap gap-2 md:flex-nowrap" action="/admin">
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={q} placeholder="Name, phone, ref, place" className={`${inputCls} mt-0 w-full min-w-0 md:w-56`} />
          <select name="service" defaultValue={service} className={`${inputCls} mt-0 min-w-0 flex-1 md:w-36 md:flex-none`}>
            <option value="">All trips</option>
            {Object.entries(SERVICES).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <button className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Go</button>
        </form>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {view === "due" ? "Nothing needs action right now." : "No leads match."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {leads.map((l) => {
            const late = l.status === "new" && !l.firstContactedAt && minutesSince(l.createdAt, now) > 15;
            const followDue = l.followUpAt && Date.parse(l.followUpAt) <= now && ["new", "contacted", "quoted"].includes(l.status);
            return (
              <li key={l.id}>
                <Link href={`/admin/leads/${l.id}`} className="grid gap-1 px-4 py-3 hover:bg-slate-50 md:grid-cols-[9rem,1fr,10rem,8rem] md:items-center md:gap-4">
                  <div className="flex items-center gap-2 md:block">
                    <span className="flex gap-1">
                      <StatusBadge status={l.status as Status} />
                      {l.isSample && <SampleBadge />}
                    </span>
                    <p className={`text-xs md:mt-1 ${late ? "font-bold text-red-600" : "text-slate-500"}`}>
                      {timeAgo(l.createdAt, now)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-navy-900">
                      {l.name} <span className="font-normal text-slate-500">· {formatPhone(l.phone)}</span>
                    </p>
                    <p className="truncate text-sm text-slate-600">
                      {SERVICES[l.service]}: {l.pickup}
                      {l.drop ? ` → ${l.drop}` : ""}
                      {l.vehicle ? ` · ${l.vehicle}` : ""}
                      {l.passengers ? ` · ${l.passengers} pax` : ""}
                    </p>
                    {followDue && <p className="text-xs font-semibold text-red-600">Follow-up due {fmtDateTime(l.followUpAt)}</p>}
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-navy-900">{fmtDate(l.travelDate)}{l.travelTime ? `, ${l.travelTime}` : ""}</p>
                    <p className="text-xs text-slate-500">{l.sourceBucket}{l.assignedTo ? ` · ${l.assignedTo}` : ""}</p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-semibold text-navy-900">{rupees(l.bookingValue ?? l.quotedAmount)}</p>
                    <p className="font-mono text-xs text-slate-500">{l.ref}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && <Link className="rounded-md border bg-white px-3 py-1" href={qs({ page: page - 1 })}>Previous</Link>}
            {page * PAGE < total && <Link className="rounded-md border bg-white px-3 py-1" href={qs({ page: page + 1 })}>Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
