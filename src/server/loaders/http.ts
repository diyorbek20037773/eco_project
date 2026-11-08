// Route handler'lar uchun umumiy javoblar.
const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: SECURITY_HEADERS });
}

export function unauthorized(): Response {
  return jsonResponse({ ok: false, code: "UNAUTHENTICATED", error: "Avval tizimga kiring." }, 401);
}

export function notFoundResponse(): Response {
  return jsonResponse({ ok: false, code: "NOT_FOUND", error: "Ma’lumot topilmadi yoki unga ruxsatingiz yo‘q." }, 404);
}

export { SECURITY_HEADERS };
