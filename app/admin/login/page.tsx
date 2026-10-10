import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/forms";
import { getStaff } from "@/lib/staff";
import { BUSINESS } from "@/lib/site";

export const metadata: Metadata = { title: "Booking desk — sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: { next?: string } }) {
  if (await getStaff()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-400 text-lg font-bold text-navy-950">S</span>
          <div>
            <p className="font-bold text-navy-900">{BUSINESS.name}</p>
            <p className="text-xs text-slate-500">Booking desk</p>
          </div>
        </div>
        <LoginForm next={searchParams.next ?? "/admin"} />
      </div>
    </main>
  );
}
