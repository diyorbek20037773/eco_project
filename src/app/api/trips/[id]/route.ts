import { getSessionUser } from "@/server/queries/session";
import { loadTripDetail } from "@/server/loaders/operator";
import { loadCollectorTrip } from "@/server/loaders/collector";
import { jsonResponse, notFoundResponse, unauthorized } from "@/server/loaders/http";

export const dynamic = "force-dynamic";

/** Reys JSON: operator — to'liq; yig'uvchi — faqat o'z reysi; do'kon → 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const data =
    user.role === "OPERATOR" ? await loadTripDetail(user, id) : user.role === "COLLECTOR" ? await loadCollectorTrip(user, id) : null;
  if (!data) return notFoundResponse();
  return jsonResponse({ ok: true, data });
}
