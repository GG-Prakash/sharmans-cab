import Link from "next/link";
import { getMetrics } from "@/lib/leads/repo";
import { countSampleLeads } from "@/lib/leads/samples";
import { SERVICES, STATUSES, rupees, type Status } from "@/lib/leads/domain";
import { fmtMins, pct } from "@/lib/format";
import { Card, Stat, StatusBadge, inputCls } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
const RANGES = [7, 30, 90, 365];

export default async function Reports({ searchParams }: { searchParams: { days?: string; gspend?: string; mspend?: string } }) {
  const days = RANGES.includes(Number(searchParams.days)) ? Number(searchParams.days) : 30;
  const [m, samples] = await Promise.all([getMetrics(days), countSampleLeads()]);
  // Ad spend is typed in from the Google/Meta dashboards (no API connection yet).
  const spend: Record<string, number> = {};
  const g = Number(searchParams.gspend);
  const me = Number(searchParams.mspend);
  if (g > 0) spend["Google Ads"] = g;
  if (me > 0) spend["Meta Ads"] = me;
  const paid = Object.entries(spend).map(([source, amount]) => {
    const s = m.bySource.find((x) => x.source === source);
    return { source, amount, leads: s?.leads ?? 0, booked: s?.booked ?? 0 };
  });
  const th = "px-2 py-2 sm:px-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
  const td = "px-2 py-2 sm:px-3";
  // Columns hidden on phones so the cost-per-booking column stays on screen without sideways scrolling.
  const wide = "hidden sm:table-cell";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Reports</h1>
        <nav className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {RANGES.map((d) => (
            <Link key={d} href={`/admin/reports?days=${d}`} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${d === days ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {d === 365 ? "1 year" : `${d} days`}
            </Link>
          ))}
        </nav>
      </div>
      {samples > 0 && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          These figures include {samples} sample leads. Remove them from the Leads page before real reporting.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Leads" value={m.leads} />
        <Stat label="Bookings" value={m.booked} hint={`Win rate ${pct(m.conversionRate)} of decided leads`} />
        <Stat label="Booked value" value={rupees(m.bookingValue)} />
        <Stat label="Median first response" value={fmtMins(m.medianResponseMins)} hint={`${pct(m.respondedWithin15)} within 15 min (website leads)`} />
      </div>

      <Card title="Where bookings come from">
        <form className="mb-3 flex flex-wrap items-end gap-2 text-sm" action="/admin/reports">
          <input type="hidden" name="days" value={days} />
          <label>
            <span className="text-xs text-slate-500">Google Ads spend (₹, same period)</span>
            <input name="gspend" defaultValue={searchParams.gspend} inputMode="numeric" className={`${inputCls} w-40`} />
          </label>
          <label>
            <span className="text-xs text-slate-500">Meta Ads spend (₹)</span>
            <input name="mspend" defaultValue={searchParams.mspend} inputMode="numeric" className={`${inputCls} w-40`} />
          </label>
          <button className="rounded-lg bg-navy-900 px-3 py-2 font-semibold text-white">Calculate</button>
        </form>
        {paid.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {paid.map((p) => (
              <Stat
                key={p.source}
                label={`${p.source} · cost per booking`}
                value={p.booked ? rupees(p.amount / p.booked) : "No bookings yet"}
                hint={`${rupees(p.amount)} spend · ${p.leads} leads (${p.leads ? rupees(p.amount / p.leads) : "—"} each) · ${p.booked} bookings`}
              />
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200">
              <tr><th className={th}>Source</th><th className={th}>Leads</th><th className={th}>Bookings</th><th className={`${th} ${wide}`}>Win %</th><th className={`${th} ${wide}`}>Value</th><th className={`${th} ${wide}`}>Cost / lead</th><th className={th}>Cost / booking</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.bySource.map((s) => (
                <tr key={s.source}>
                  <td className={`${td} font-medium text-navy-900`}>{s.source}</td>
                  <td className={td}>{s.leads}</td>
                  <td className={td}>{s.booked}</td>
                  <td className={`${td} ${wide}`}>{pct(s.leads ? s.booked / s.leads : null)}</td>
                  <td className={`${td} ${wide}`}>{rupees(s.value)}</td>
                  <td className={`${td} ${wide}`}>{spend[s.source] ? rupees(spend[s.source] / s.leads) : "—"}</td>
                  <td className={`${td} font-semibold`}>{spend[s.source] ? (s.booked ? rupees(spend[s.source] / s.booked) : "no bookings") : "—"}</td>
                </tr>
              ))}
              {!m.bySource.length && <tr><td className={td} colSpan={7}>No leads in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="By trip type">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200"><tr><th className={th}>Trip</th><th className={th}>Leads</th><th className={th}>Booked</th><th className={th}>Value</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {m.byService.map((s) => (
                <tr key={s.service}><td className={td}>{SERVICES[s.service]}</td><td className={td}>{s.leads}</td><td className={td}>{s.booked}</td><td className={td}>{rupees(s.value)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Pipeline now (this period's leads)">
          <ul className="space-y-1.5 text-sm">
            {(Object.keys(STATUSES) as Status[]).map((s) => (
              <li key={s} className="flex items-center justify-between"><StatusBadge status={s} /><span className="font-semibold">{m.byStatus[s]}</span></li>
            ))}
          </ul>
          {m.lostReasons.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Why leads were lost</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {m.lostReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between"><span>{r.reason}</span><span className="font-semibold">{r.count}</span></li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="Exports">
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-navy-900 hover:bg-slate-50" href={`/admin/export?type=leads&days=${days}`}>All leads (CSV)</a>
          <a className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-navy-900 hover:bg-slate-50" href={`/admin/export?type=google&days=90`}>Google Ads offline conversions (CSV)</a>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Upload the Google file in Google Ads → Goals → Conversions → Uploads, to a conversion action named &ldquo;Booked trip&rdquo;. Bidding then optimises for bookings, not form fills.
        </p>
      </Card>
    </div>
  );
}
