"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, SESSION_HOURS, checkPassword, createSessionToken, sessionSecret } from "@/lib/auth";
import { requireStaff } from "@/lib/staff";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { fromLocalInput } from "@/lib/format";
import { ManualLeadSchema, STATUS_KEYS, fieldErrors, isRealIsoDate, type Status } from "@/lib/leads/domain";
import {
  WorkflowError,
  addNote,
  createManualLead,
  markContacted,
  transitionLead,
  updateLead,
  type LeadPatch,
} from "@/lib/leads/repo";

export type ActionState = { ok?: boolean; error?: string; fields?: Record<string, string>; at?: number };

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
// Amounts are stored as Postgres int; anything above ₹10 crore is a typo, not a fare.
const MAX_RUPEES = 100_000_000;
const money = (v: string) => {
  const n = Number(v.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= MAX_RUPEES ? Math.round(n) : null;
};

async function guarded(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true, at: Date.now() };
  } catch (e) {
    if (e instanceof WorkflowError) return { error: e.message, at: Date.now() };
    // redirect() throws a special error that must propagate.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error("[admin action]", e);
    return { error: "Something went wrong. Please try again.", at: Date.now() };
  }
}

/* ---------- Session ---------- */

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!sessionSecret() || !process.env.ADMIN_PASSWORD) {
    return { error: "The desk isn't configured yet: set ADMIN_PASSWORD and SESSION_SECRET." };
  }
  const rl = rateLimit(`login:${clientIp(headers())}`, 10, 15 * 60_000);
  if (!rl.ok) return { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} min.` };

  const name = str(fd, "name").slice(0, 40);
  if (name.length < 2) return { fields: { name: "Enter your name — it's recorded on every action you take." } };
  if (!(await checkPassword(str(fd, "password")))) return { fields: { password: "Wrong password." } };

  cookies().set(SESSION_COOKIE, await createSessionToken(name), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  const next = str(fd, "next");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/admin/login");
}

/* ---------- Lead workflow ---------- */

export async function changeStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  return guarded(async (): Promise<ActionState | void> => {
    const id = str(fd, "id");
    const to = str(fd, "to") as Status;
    if (!STATUS_KEYS.includes(to)) return { error: "Unknown status" };
    await transitionLead(
      id,
      {
        to,
        quotedAmount: money(str(fd, "quotedAmount")),
        bookingValue: money(str(fd, "bookingValue")),
        lostReason: str(fd, "lostReason") || null,
      },
      staff.name,
    );
    revalidatePath(`/admin/leads/${id}`);
    revalidatePath("/admin");
  });
}

export async function saveDetails(_: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  return guarded(async (): Promise<ActionState | void> => {
    const id = str(fd, "id");
    const passengers = str(fd, "passengers");
    const date = str(fd, "travelDate");
    const time = str(fd, "travelTime");
    if (date && !isRealIsoDate(date)) return { fields: { travelDate: "Invalid date" } };
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { fields: { travelTime: "Invalid time" } };
    const pax = Number(passengers);
    if (passengers && !(Number.isInteger(pax) && pax >= 1 && pax <= 200)) return { fields: { passengers: "Whole number, 1–200" } };
    if (str(fd, "name").length < 1) return { fields: { name: "Name can't be empty" } };
    if (str(fd, "pickup").length < 2) return { fields: { pickup: "Pickup can't be empty" } };
    const patch: LeadPatch = {
      name: str(fd, "name"),
      pickup: str(fd, "pickup"),
      drop: str(fd, "drop") || null,
      travelDate: date || null,
      travelTime: time || null,
      vehicle: str(fd, "vehicle") || null,
      passengers: passengers ? Number(passengers) : null,
      assignedTo: str(fd, "assignedTo") || null,
      followUpAt: fromLocalInput(str(fd, "followUpAt")),
    };
    await updateLead(id, patch, staff.name);
    revalidatePath(`/admin/leads/${id}`);
    revalidatePath("/admin");
  });
}

export async function saveNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  return guarded(async (): Promise<ActionState | void> => {
    const id = str(fd, "id");
    await addNote(id, str(fd, "text"), staff.name);
    revalidatePath(`/admin/leads/${id}`);
  });
}

/** Called just before the browser opens the dialer / WhatsApp, so response time is measured. */
export async function logContact(id: string, via: "call" | "whatsapp") {
  const staff = await requireStaff();
  await markContacted(id, staff.name, via);
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin");
}

export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = ManualLeadSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fields: fieldErrors(parsed.error), error: "Please fix the highlighted fields." };
  let id = "";
  const res = await guarded(async () => {
    id = (await createManualLead(parsed.data, staff.name)).id;
  });
  if (res.error) return res;
  revalidatePath("/admin");
  redirect(`/admin/leads/${id}`);
}
