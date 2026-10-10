import { Card } from "@/components/admin/ui";
import { ManualLeadForm } from "@/components/admin/forms";

export default function NewLead() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Log a call or chat</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every enquiry goes in here, not just website forms. Phone and WhatsApp leads are most of the business, and
          without them the reports can&apos;t show which marketing actually brings bookings.
        </p>
      </div>
      <Card>
        <ManualLeadForm />
      </Card>
    </div>
  );
}
