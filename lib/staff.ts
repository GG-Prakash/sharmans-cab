import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken, type Staff } from "@/lib/auth";

export async function getStaff(): Promise<Staff | null> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

/** Every desk page and server action calls this, in addition to the middleware check. */
export async function requireStaff(): Promise<Staff> {
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  return s;
}
