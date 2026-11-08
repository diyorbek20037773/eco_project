import { readStoredFile } from "@/lib/storage";
import { getSessionUser } from "@/server/queries/session";
import { findViewableAttachment } from "@/server/loaders/files";
import { SECURITY_HEADERS, notFoundResponse, unauthorized } from "@/server/loaders/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const att = await findViewableAttachment(user, id);
  if (!att) return notFoundResponse();
  const buf = await readStoredFile(att.storageKey);
  if (!buf) return notFoundResponse();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": att.mimeType,
      "Content-Length": String(buf.length),
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}
