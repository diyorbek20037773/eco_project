import { getSessionUser } from "@/server/queries/session";
import { loadShopRequest } from "@/server/loaders/shop";
import { jsonResponse, notFoundResponse, unauthorized } from "@/server/loaders/http";

export const dynamic = "force-dynamic";

/** Buyurtma JSON: do'kon — o'ziniki; yig'uvchi — o'z reysidagi; operator — hammasi. Begona → 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const data = await loadShopRequest(user, id);
  if (!data) return notFoundResponse();
  return jsonResponse({ ok: true, data });
}
