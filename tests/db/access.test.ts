// Ruxsatsiz murojaat: begona do'kon/yig'uvchi obyektlari NOT_FOUND / null; rol mos emas → FORBIDDEN.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { authenticate, LOGIN_FAILED } from "@/server/services/auth";
import { recordWeighing, skipStop } from "@/server/services/collector";
import { cancelPickupRequest, confirmStopWeight, createPickupRequest, disputeStopWeight } from "@/server/services/shop";
import { createTrip, recordPayment } from "@/server/services/trips";
import { uploadImage } from "@/server/services/upload";
import { findViewableAttachment } from "@/server/loaders/files";
import { loadShopRequest } from "@/server/loaders/shop";
import { loadCollectorStop, loadCollectorTrip } from "@/server/loaders/collector";
import { loadTripDetail } from "@/server/loaders/operator";
import { collectedTrip, accept, expectError, key, makeWorld, newRequest, newTrip, obligationsOf, okData, stopsOf, today, type World } from "./helpers";

let w: World;
beforeAll(async () => {
  w = await makeWorld();
});
afterEach(() => vi.unstubAllEnvs());

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);

describe("begona obyektlar", () => {
  it("boshqa do‘kon buyurtmasi, bekati va nuqtasi", async () => {
    const shop1 = w.shops[0]!;
    const shop2 = w.shops[1]!.actor;
    const req = await newRequest(w, 0);
    expect(await loadShopRequest(shop2, req)).toBeNull();
    expect(await loadShopRequest(shop1.actor, req)).not.toBeNull();
    expectError(await cancelPickupRequest(shop2, { requestId: req }), "NOT_FOUND");
    // boshqa do'kon nuqtasiga buyurtma
    expectError(
      await createPickupRequest(shop2, { clientKey: key(), pointId: shop1.pointId, readyDate: today(), fromTime: "10:00", toTime: "12:00", estimatedKg: "10" }),
      "VALIDATION",
    );

    const tripId = await newTrip(w, [req]);
    const [stop] = await stopsOf(tripId);
    okData(await recordWeighing(w.collector, { stopId: stop!.id, clientKey: key(), grossKg: "20", tareKg: "0" }));
    expectError(await confirmStopWeight(shop2, { stopId: stop!.id }), "NOT_FOUND");
    expectError(await disputeStopWeight(shop2, { stopId: stop!.id, reason: "Begona e’tiroz testi" }), "NOT_FOUND");
  });

  it("boshqa yig‘uvchi reysi va bekati", async () => {
    const req = await newRequest(w, 1);
    const tripId = await newTrip(w, [req]);
    const [stop] = await stopsOf(tripId);
    expectError(await recordWeighing(w.collector2, { stopId: stop!.id, clientKey: key(), grossKg: "20", tareKg: "0" }), "NOT_FOUND");
    expectError(await skipStop(w.collector2, { stopId: stop!.id, reason: "Begona" }), "NOT_FOUND");
    expect(await loadCollectorStop(w.collector2, stop!.id)).toBeNull();
    expect(await loadCollectorTrip(w.collector2, tripId)).toBeNull();
    expect(await loadCollectorTrip(w.collector, tripId)).not.toBeNull();
    // do'kon reysni ko'ra olmaydi
    expect(await loadTripDetail(w.shops[1]!.actor, tripId)).toBeNull();
  });

  it("rol mos emas → FORBIDDEN", async () => {
    const shop = w.shops[0]!.actor;
    expectError(
      await createTrip(shop, { clientKey: key(), requestIds: ["x"], collectorId: w.collector.id, buyerId: w.buyerId, date: today(), fromTime: "09:00", toTime: "10:00", shopPricePerKg: 1, buyerPricePerKg: 1, serviceFee: 0 }),
      "FORBIDDEN",
    );
    expectError(await recordPayment(w.collector, { obligationId: "x", clientKey: key(), amount: 1, paidDate: today() }), "FORBIDDEN");
    expectError(await recordWeighing(w.operator, { stopId: "x", clientKey: key(), grossKg: "1", tareKg: "" }), "FORBIDDEN");
    expectError(await createPickupRequest(null, { clientKey: key(), pointId: "x", readyDate: today(), fromTime: "10:00", toTime: "11:00" }), "UNAUTHENTICATED");
  });
});

describe("rasm yuklash va fayl ruxsati", () => {
  it("haqiqiy PNG saqlanadi; soxta tur rad; begona fayl ko‘rinmaydi; boshqa birov bog‘lay olmaydi", async () => {
    const shop1 = w.shops[0]!;
    const shop2 = w.shops[1]!;
    const up = okData(await uploadImage(shop1.actor, { file: new File([PNG], "a.png", { type: "image/png" }), kind: "REQUEST_PHOTO" }));
    expect(up.url).toBe(`/api/files/${up.attachmentId}`);
    const fake = await uploadImage(shop1.actor, { file: new File([new TextEncoder().encode("<svg/>")], "a.png", { type: "image/png" }), kind: "REQUEST_PHOTO" });
    expectError(fake, "UPLOAD_INVALID");
    expectError(await uploadImage(shop1.actor, { file: new File([PNG], "a.png"), kind: "ACCEPTANCE_DOC" }), "FORBIDDEN");

    // boshqa do'kon bog'lay olmaydi
    expectError(
      await createPickupRequest(shop2.actor, { clientKey: key(), pointId: shop2.pointId, readyDate: today(), fromTime: "10:00", toTime: "12:00", estimatedKg: "10", photoAttachmentId: up.attachmentId }),
      "VALIDATION",
    );
    expect(await prisma.pickupRequest.count({ where: { shopId: shop2.shopId, attachments: { some: { id: up.attachmentId } } } })).toBe(0);

    const { requestId } = okData(
      await createPickupRequest(shop1.actor, { clientKey: key(), pointId: shop1.pointId, readyDate: today(), fromTime: "10:00", toTime: "12:00", volume: "SMALL", photoAttachmentId: up.attachmentId }),
    );
    expect((await prisma.attachment.findUniqueOrThrow({ where: { id: up.attachmentId } })).requestId).toBe(requestId);
    expect(await findViewableAttachment(shop1.actor, up.attachmentId)).not.toBeNull();
    expect(await findViewableAttachment(shop2.actor, up.attachmentId)).toBeNull();
    expect(await findViewableAttachment(w.collector2, up.attachmentId)).toBeNull();
    expect(await findViewableAttachment(w.operator, up.attachmentId)).not.toBeNull();
    // reysga kiritilgandan keyin o'z yig'uvchisi ko'radi
    await newTrip(w, [requestId]);
    expect(await findViewableAttachment(w.collector, up.attachmentId)).not.toBeNull();
    expect(await findViewableAttachment(w.collector2, up.attachmentId)).toBeNull();
  });

  it("qabul hujjati faqat operatorga", async () => {
    const doc = okData(await uploadImage(w.operator, { file: new File([PNG], "d.png"), kind: "ACCEPTANCE_DOC" }));
    const { tripId } = await collectedTrip(w);
    const r = await accept(w, tripId, "470");
    okData(r);
    // hujjatni alohida tuzatish yo'q — to'g'ridan-to'g'ri bog'laymiz va ruxsatni tekshiramiz
    const acc = await prisma.buyerAcceptance.findUniqueOrThrow({ where: { tripId } });
    await prisma.attachment.update({ where: { id: doc.attachmentId }, data: { acceptanceId: acc.id } });
    expect(await findViewableAttachment(w.operator, doc.attachmentId)).not.toBeNull();
    expect(await findViewableAttachment(w.collector, doc.attachmentId)).toBeNull();
    expect(await findViewableAttachment(w.shops[0]!.actor, doc.attachmentId)).toBeNull();
    // do'kon faqat o'z to'lov majburiyatini ko'radi (reys iqtisodi operatorda)
    const ob = await obligationsOf(tripId);
    expect(Object.keys(ob).length).toBe(5);
  });
});

describe("login", () => {
  it("noto‘g‘ri parol va yo‘q login — umumiy xabar; o‘chirilgan akkaunt rad; demo production’da rad", async () => {
    const op = await prisma.user.findUniqueOrThrow({ where: { id: w.operator.id } });
    expect(await authenticate(op.login, "TestParol123!")).toMatchObject({ ok: true, role: "OPERATOR" });
    expect(await authenticate(op.login, "noto'g'ri-parol")).toEqual({ ok: false, error: LOGIN_FAILED });
    expect(await authenticate("bunday-login-yoq", "TestParol123!")).toEqual({ ok: false, error: LOGIN_FAILED });

    await prisma.user.update({ where: { id: op.id }, data: { isDemo: true } });
    vi.stubEnv("NODE_ENV", "production");
    const demo = await authenticate(op.login, "TestParol123!");
    expect(demo.ok).toBe(false);
    vi.unstubAllEnvs();
    await prisma.user.update({ where: { id: op.id }, data: { isDemo: false } });

    const col = await prisma.user.findUniqueOrThrow({ where: { id: w.collector2.id } });
    await prisma.user.update({ where: { id: col.id }, data: { isActive: false } });
    expect((await authenticate(col.login, "TestParol123!")).ok).toBe(false);
    await prisma.user.update({ where: { id: col.id }, data: { isActive: true } });
  });
});
