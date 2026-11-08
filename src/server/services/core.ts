// Servis qatlami uchun umumiy yordamchilar: actor, natija o'rami, tranzaksiya, audit,
// shartli holat o'tishi va zod validatsiyasi. Next.js'ga bog'liq emas (testlardan to'g'ridan-to'g'ri chaqiriladi).
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ActionResult, DisputeStatus, RequestStatus, Role, StopStatus, TripStatus } from "@/server/contract";
import { DomainError, conflict, forbidden, internalError, invalidTransition, isDomainError, validation } from "@/domain/errors";
import { canTransition, type Machine } from "@/domain/transitions";

export type Tx = Prisma.TransactionClient;

/** Amalni bajarayotgan foydalanuvchi (sessiyadan). */
export interface Actor {
  id: string;
  role: Role;
  shopId: string | null;
  name?: string;
}

export function requireRole(actor: Actor | null | undefined, ...roles: Role[]): Actor {
  if (!actor) throw new DomainError("UNAUTHENTICATED", "Avval tizimga kiring.");
  if (!roles.includes(actor.role)) throw forbidden();
  return actor;
}

export function ok<T>(data: T, extra?: { message?: string; replayed?: boolean }): ActionResult<T> {
  const r: ActionResult<T> = { ok: true, data };
  if (extra?.message) r.message = extra.message;
  if (extra?.replayed) r.replayed = true;
  return r;
}

export function okEmpty(extra?: { message?: string; replayed?: boolean }): ActionResult {
  return ok(undefined, extra);
}

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

function isRetryable(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P2028")) return true;
  const msg = e instanceof Error ? e.message : "";
  return /could not serialize access|deadlock detected|40001|40P01/i.test(msg);
}

/** Servis natijasini o'raydi: DomainError → ActionResult, kutilmagan → INTERNAL (log bilan). */
export async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (isDomainError(e)) return e.toResult();
    if (isUniqueViolation(e)) return conflict().toResult();
    console.error("[ecopoint] kutilmagan xato:", e);
    return internalError();
  }
}

/** Interaktiv tranzaksiya; serializatsiya/deadlock xatosida qisqa qayta urinish. */
export async function withTx<T>(
  fn: (tx: Tx) => Promise<T>,
  opts: { isolationLevel?: Prisma.TransactionIsolationLevel; retries?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: opts.isolationLevel,
        maxWait: 10_000,
        timeout: 20_000,
      });
    } catch (e) {
      if (attempt < retries && isRetryable(e)) {
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
}

/**
 * Idempotent yaratish: avval clientKey bo'yicha mavjudini qidiradi; unique buzilsa
 * (parallel takror) yana qidiradi va avvalgi natijani `replayed: true` bilan qaytaradi.
 */
export async function idempotent<T>(
  find: () => Promise<ActionResult<T> | null>,
  create: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const existing = await find();
  if (existing) return existing;
  try {
    return await create();
  } catch (e) {
    // Parallel takror: boshqa so'rov xuddi shu clientKey bilan yozib ulgurgan bo'lsa
    // (unique buzilishi yoki holat o'tishi rad etilgan) — avvalgi natija qaytariladi.
    if (isUniqueViolation(e) || isDomainError(e)) {
      const again = await find();
      if (again) return again;
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
export interface AuditInput {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  tripId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

function toJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (v === undefined || v === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

export async function audit(tx: Tx, a: AuditInput): Promise<void> {
  await tx.auditEvent.create({
    data: {
      actorId: a.actorId,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      tripId: a.tripId ?? null,
      reason: a.reason ?? null,
      before: toJson(a.before),
      after: toJson(a.after),
    },
  });
}

// ---------------------------------------------------------------------------
// Shartli holat o'tishlari: updateMany({ id, status in from }) va count === 1
// ---------------------------------------------------------------------------
function checkTable(machine: Machine, from: readonly string[], to: string) {
  for (const f of from) {
    if (!canTransition(machine as never, f as never, to as never)) {
      throw new Error(`Dasturiy xato: ${machine} ${f} → ${to} jadvalda yo'q`);
    }
  }
}


export async function moveRequest(
  tx: Tx,
  id: string,
  from: RequestStatus[],
  to: RequestStatus,
  data: Prisma.PickupRequestUpdateManyMutationInput = {},
  message?: string,
): Promise<void> {
  checkTable("request", from, to);
  const r = await tx.pickupRequest.updateMany({ where: { id, status: { in: from } }, data: { ...data, status: to } });
  if (r.count !== 1) throw invalidTransition(message ?? "Buyurtma holati o‘zgargan. Sahifani yangilang.");
}

export async function moveTrip(
  tx: Tx,
  id: string,
  from: TripStatus[],
  to: TripStatus,
  data: Prisma.TripUpdateManyMutationInput = {},
  message?: string,
): Promise<void> {
  checkTable("trip", from, to);
  const r = await tx.trip.updateMany({
    where: { id, status: { in: from } },
    data: { ...data, status: to, version: { increment: 1 } },
  });
  if (r.count !== 1) throw invalidTransition(message ?? "Reys holati o‘zgargan. Sahifani yangilang.");
}

export async function moveStop(
  tx: Tx,
  id: string,
  from: StopStatus[],
  to: StopStatus,
  data: Prisma.TripStopUncheckedUpdateManyInput = {},
  message?: string,
): Promise<void> {
  checkTable("stop", from, to);
  const r = await tx.tripStop.updateMany({ where: { id, status: { in: from } }, data: { ...data, status: to } });
  if (r.count !== 1) throw invalidTransition(message ?? "Bekat holati o‘zgargan. Sahifani yangilang.");
}

export async function moveDispute(
  tx: Tx,
  id: string,
  from: DisputeStatus[],
  to: DisputeStatus,
  data: Prisma.DisputeUncheckedUpdateManyInput = {},
  message?: string,
): Promise<void> {
  checkTable("dispute", from, to);
  const r = await tx.dispute.updateMany({ where: { id, status: { in: from } }, data: { ...data, status: to } });
  if (r.count !== 1) throw invalidTransition(message ?? "Bahs holati o‘zgargan. Sahifani yangilang.");
}

/** Qator qulfi (SELECT … FOR UPDATE). Jadval nomi faqat ichki konstantalardan. */
export async function lockRow(tx: Tx, table: "Trip" | "Obligation" | "Dispute" | "TripStop", id: string): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
  return rows.length === 1;
}

// ---------------------------------------------------------------------------
// Validatsiya
// ---------------------------------------------------------------------------
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const fieldErrors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  const first = Object.values(fieldErrors)[0];
  throw validation(first ?? "Formadagi xatolarni tuzating.", fieldErrors);
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const zId = z.string().regex(ID_RE, "Noto‘g‘ri identifikator.");
export const zClientKey = z.string().trim().min(8, "Forma kaliti yo‘q. Sahifani yangilang.").max(100, "Forma kaliti juda uzun.");
export const zText = (max: number, label = "Matn") => z.string().trim().max(max, `${label} ${max} belgidan oshmasin.`);
export const zOptText = (max: number, label = "Matn") =>
  z
    .string()
    .trim()
    .max(max, `${label} ${max} belgidan oshmasin.`)
    .optional()
    .transform((v) => (v ? v : undefined));
export const zRequiredText = (min: number, max: number, msg: string) =>
  z.string({ error: msg }).trim().min(min, msg).max(max, `Matn ${max} belgidan oshmasin.`);
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sanani tanlang.");
export const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqtni SS:dd ko‘rinishida kiriting.");
export const zSom = (label: string) =>
  z
    .number({ error: `${label}ni so‘mda kiriting.` })
    .int(`${label} butun so‘m bo‘lsin.`)
    .min(0, `${label} manfiy bo‘lmaydi.`)
    .max(1_000_000_000_000, `${label} juda katta.`);
export const zPhone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Telefon raqamini to‘g‘ri kiriting, masalan +998 90 123 45 67.");
export const zLogin = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Login 3–32 belgi: lotin harflari, raqam, nuqta, chiziqcha.");
