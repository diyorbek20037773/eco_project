import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import { assertTransition, canTransition, sourcesFor } from "@/domain/transitions";

describe("holat o‘tishlari jadvali", () => {
  it("buyurtma", () => {
    expect(canTransition("request", "NEW", "PLANNED")).toBe(true);
    expect(canTransition("request", "PLANNED", "SKIPPED")).toBe(true);
    expect(canTransition("request", "SKIPPED", "PLANNED")).toBe(true);
    expect(canTransition("request", "COLLECTED", "DISPUTED")).toBe(true);
    expect(canTransition("request", "DISPUTED", "CONFIRMED")).toBe(true);
    expect(canTransition("request", "CONFIRMED", "SETTLED")).toBe(true);
    expect(canTransition("request", "NEW", "COLLECTED")).toBe(false);
    expect(canTransition("request", "COLLECTED", "CANCELLED")).toBe(false);
    expect(canTransition("request", "SETTLED", "NEW")).toBe(false);
    expect(canTransition("request", "DISPUTED", "SETTLED")).toBe(false);
  });

  it("reys", () => {
    expect(canTransition("trip", "PLANNED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("trip", "IN_PROGRESS", "COLLECTED")).toBe(true);
    expect(canTransition("trip", "COLLECTED", "ACCEPTED")).toBe(true);
    expect(canTransition("trip", "ACCEPTED", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransition("trip", "AWAITING_PAYMENT", "CLOSED")).toBe(true);
    expect(canTransition("trip", "CLOSED", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransition("trip", "PLANNED", "ACCEPTED")).toBe(false);
    expect(canTransition("trip", "COLLECTED", "CLOSED")).toBe(false);
    expect(canTransition("trip", "IN_PROGRESS", "PLANNED")).toBe(false);
    expect(canTransition("trip", "ACCEPTED", "CANCELLED")).toBe(false);
    expect(canTransition("trip", "CANCELLED", "PLANNED")).toBe(false);
  });

  it("bekat va bahs", () => {
    expect(canTransition("stop", "PENDING", "COLLECTED")).toBe(true);
    expect(canTransition("stop", "SKIPPED", "COLLECTED")).toBe(false);
    expect(canTransition("stop", "COLLECTED", "PENDING")).toBe(false);
    expect(canTransition("dispute", "OPEN", "DECIDED")).toBe(true);
    expect(canTransition("dispute", "DECIDED", "OPEN")).toBe(true);
    expect(canTransition("dispute", "DECIDED", "RESOLVED")).toBe(true);
    expect(canTransition("dispute", "OPEN", "RESOLVED")).toBe(false);
    expect(canTransition("dispute", "RESOLVED", "OPEN")).toBe(false);
  });

  it("assertTransition o‘zbekcha INVALID_TRANSITION beradi", () => {
    expect(() => assertTransition("trip", "PLANNED", "CLOSED")).toThrow(DomainError);
    try {
      assertTransition("trip", "PLANNED", "CLOSED");
    } catch (e) {
      expect((e as DomainError).code).toBe("INVALID_TRANSITION");
      expect((e as DomainError).message).toMatch(/Reys/);
    }
    expect(() => assertTransition("trip", "PLANNED", "IN_PROGRESS")).not.toThrow();
  });

  it("sourcesFor", () => {
    expect(sourcesFor("request", "PLANNED").sort()).toEqual(["NEW", "SKIPPED"]);
    expect(sourcesFor("trip", "CLOSED").sort()).toEqual(["ACCEPTED", "AWAITING_PAYMENT"]);
  });
});
