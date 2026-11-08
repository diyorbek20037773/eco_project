import { redirect } from "next/navigation";
import type { SessionUser } from "@/server/contract";
import { getSessionUser } from "@/server/queries/session";
import { homeFor, routes } from "@/lib/routes";

export default async function RootPage() {
  const user: SessionUser | null = await getSessionUser();
  redirect(user ? homeFor(user.role) : routes.login);
}
