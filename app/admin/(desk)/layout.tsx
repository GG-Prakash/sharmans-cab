import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/admin/actions";
import { requireStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Booking desk", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Leads", short: "Leads" },
  { href: "/admin/new", label: "+ Log a call", short: "+ Log" },
  { href: "/admin/reports", label: "Reports", short: "Reports" },
];

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-navy-800 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
          <Link href="/admin" className="mr-2 flex items-center gap-2 font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-amber-400 text-sm text-navy-950">S</span>
            <span className="hidden sm:inline">Booking desk</span>
          </Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium text-navy-100 hover:bg-navy-800 hover:text-white sm:px-3">
                {/* Short labels keep all three tabs visible on a 360px phone. */}
                <span className="sm:hidden">{n.short}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
          <form action={logout} className="flex items-center gap-2 text-sm">
            <span className="hidden text-navy-200 sm:inline">{staff.name}</span>
            <button className="rounded-md px-2 py-1.5 text-navy-200 hover:bg-navy-800 hover:text-white">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
