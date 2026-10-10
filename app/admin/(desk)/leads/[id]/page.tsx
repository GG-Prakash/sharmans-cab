import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead, leadsByPhone, type LeadEvent } from "@/lib/leads/repo";
import { CHANNELS, SERVICES, STATUSES, formatPhone, rupees, type Status } from "@/lib/leads/domain";
import { fmtDate, fmtDateTime, fmtMins, toLocalInput } from "@/lib/format";
import { Card, StatusBadge } from "@/components/admin/ui";
import { ContactButtons, DetailsForm, NoteForm, StatusActions } from "@/components/admin/forms";
import { BUSINESS } from "@/lib/site";

export const dynamic = "force-dynamic";

function describe(e: LeadEvent): string {
  const d = e.data as Record<string, unknown>;
  switch (e.type) {
    case "created":
      return `Lead created (${CHANNELS[d.channel as keyof typeof CHANNELS] ?? d.channel})`;
    case "status": {
      const extra = d.quotedAmount
        ? ` · quoted ${rupees(Number(d.quotedAmount))}`
        : d.bookingValue
          ? ` · ${rupees(Number(d.bookingValue))}`
          : d.lostReason
            ? ` · ${d.lostReason}`
            : "";
      return `${STATUSES[d.from as Status]} → ${STATUSES[d.to as Status]}${extra}`;
    }
    case "contact":
      return d.via === "call" ? "Called the customer" : "Messaged on WhatsApp";
    case "note":
      return String(d.text);
    case "edit":
      return `Updated ${Object.keys((d.changes as object) ?? {}).join(", ")}`;
    case "resubmitted":
      return "Customer submitted the form again for the same trip";
    case "notify_ok":
      return `Notification sent (${d.channel})`;
    case "notify_failed":
      return `Notification FAILED (${d.channel}): ${d.error}`;
    default:
      return e.type;
  }
}

export default async function LeadPage({ params }: { params: { id: string } }) {
  const found = await getLead(params.id);
  if (!found) notFound();
  const { lead: l, events } = found;
  const others = await leadsByPhone(l.phone, l.id);
  const responseMins = l.firstContactedAt ? (Date.parse(l.firstContactedAt) - Date.parse(l.createdAt)) / 60_000 : null;

  const route = l.drop ? `${l.pickup} to ${l.drop}` : l.pickup;
  const waText =
    `Hi ${l.name}, this is ${BUSINESS.name} about your enquiry ${l.ref}` +
    ` (${SERVICES[l.service]}, ${route}${l.travelDate ? `, ${fmtDate(l.travelDate)}` : ""}).`;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-navy-600 hover:underline">← Leads</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-navy-900">{l.name}</h1>
          <StatusBadge status={l.status} />
          <span className="font-mono text-sm text-slate-500">{l.ref}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {SERVICES[l.service]} · {route} · {fmtDate(l.travelDate)}
          {l.travelTime ? `, ${l.travelTime}` : ""}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr,22rem]">
        <div className="space-y-5">
          <Card title="Next step">
            <StatusActions id={l.id} status={l.status} quotedAmount={l.quotedAmount} />
          </Card>

          <Card title="Trip details">
            <DetailsForm
              v={{
                id: l.id,
                name: l.name,
                pickup: l.pickup,
                drop: l.drop ?? "",
                travelDate: l.travelDate ?? "",
                travelTime: l.travelTime ?? "",
                vehicle: l.vehicle ?? "",
                passengers: l.passengers?.toString() ?? "",
                assignedTo: l.assignedTo ?? "",
                followUpAt: toLocalInput(l.followUpAt),
              }}
            />
          </Card>

          <Card title="Timeline">
            <NoteForm id={l.id} />
            <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full ${e.type === "notify_failed" ? "bg-red-500" : e.type === "note" ? "bg-amber-400" : "bg-slate-300"}`} />
                  <p className={`text-sm ${e.type === "note" ? "whitespace-pre-wrap font-medium text-navy-900" : e.type === "notify_failed" ? "text-red-700" : "text-slate-700"}`}>
                    {describe(e)}
                  </p>
                  <p className="text-xs text-slate-500">{fmtDateTime(e.at)} · {e.actor}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card title="Customer">
            <p className="text-lg font-semibold text-navy-900">{formatPhone(l.phone)}</p>
            <div className="mt-3">
              <ContactButtons id={l.id} phone={l.phone} waText={waText} />
            </div>
            {l.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{l.message}</p>}
          </Card>

          <Card title="Money">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-slate-500">Quoted</dt>
              <dd className="text-right font-semibold">{rupees(l.quotedAmount)}</dd>
              <dt className="text-slate-500">Booked value</dt>
              <dd className="text-right font-semibold">{rupees(l.bookingValue)}</dd>
              {l.lostReason && (
                <>
                  <dt className="text-slate-500">Lost because</dt>
                  <dd className="text-right">{l.lostReason}</dd>
                </>
              )}
            </dl>
          </Card>

          <Card title="Where it came from">
            <dl className="space-y-1 text-sm">
              {[
                ["Channel", CHANNELS[l.channel]],
                ["Source", l.sourceBucket],
                ["Campaign", l.campaign],
                ["Keyword", l.term],
                ["Landing page", l.landingPage],
                ["Google click ID", l.gclid ? "captured ✓" : null],
                ["Meta click ID", l.fbclid ? "captured ✓" : null],
                ["Received", fmtDateTime(l.createdAt)],
                ["First response", responseMins != null ? `${fmtMins(responseMins)} after enquiry` : l.status === "new" ? "Not yet" : null],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="truncate text-right text-navy-900" title={String(v)}>{v}</dd>
                  </div>
                ))}
            </dl>
          </Card>

          {others.length > 0 && (
            <Card title={`Same phone · ${others.length} other`}>
              <ul className="space-y-2 text-sm">
                {others.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/leads/${o.id}`} className="flex items-center justify-between gap-2 hover:underline">
                      <span className="truncate">{SERVICES[o.service]} · {fmtDate(o.travelDate)}</span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
