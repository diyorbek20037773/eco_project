// Holat o'tishlari — ruxsat jadvallari (docs/contract.md §3). Faqat server o'tkazadi.
import type { DisputeStatus, RequestStatus, StopStatus, TripStatus } from "@/server/contract";
import { DomainError } from "./errors";

type Table<S extends string> = Readonly<Record<S, readonly S[]>>;

export const REQUEST_TRANSITIONS: Table<RequestStatus> = {
  NEW: ["PLANNED", "CANCELLED"],
  PLANNED: ["COLLECTED", "SKIPPED", "NEW"],
  SKIPPED: ["PLANNED", "CANCELLED"],
  COLLECTED: ["CONFIRMED", "DISPUTED"],
  DISPUTED: ["CONFIRMED"],
  CONFIRMED: ["SETTLED"],
  SETTLED: [],
  CANCELLED: [],
};

export const TRIP_TRANSITIONS: Table<TripStatus> = {
  PLANNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["ACCEPTED"],
  ACCEPTED: ["AWAITING_PAYMENT", "CLOSED"],
  AWAITING_PAYMENT: ["CLOSED"],
  // Yopilgandan keyingi tuzatish qoldiq hosil qilsa:
  CLOSED: ["AWAITING_PAYMENT"],
  CANCELLED: [],
};

export const STOP_TRANSITIONS: Table<StopStatus> = {
  PENDING: ["COLLECTED", "SKIPPED", "REMOVED"],
  COLLECTED: [],
  SKIPPED: [],
  REMOVED: [],
};

export const DISPUTE_TRANSITIONS: Table<DisputeStatus> = {
  OPEN: ["DECIDED"],
  DECIDED: ["RESOLVED", "OPEN"],
  RESOLVED: [],
};

export type Machine = "request" | "trip" | "stop" | "dispute";

const TABLES = {
  request: REQUEST_TRANSITIONS,
  trip: TRIP_TRANSITIONS,
  stop: STOP_TRANSITIONS,
  dispute: DISPUTE_TRANSITIONS,
} as const;

type StatusOf<M extends Machine> = M extends "request"
  ? RequestStatus
  : M extends "trip"
    ? TripStatus
    : M extends "stop"
      ? StopStatus
      : DisputeStatus;

export function canTransition<M extends Machine>(machine: M, from: StatusOf<M>, to: StatusOf<M>): boolean {
  const table = TABLES[machine] as Table<string>;
  return (table[from] ?? []).includes(to);
}

const NAMES: Record<Machine, string> = { request: "Buyurtma", trip: "Reys", stop: "Bekat", dispute: "Bahs" };

/** Ruxsat etilmagan o'tishda INVALID_TRANSITION xatosi. */
export function assertTransition<M extends Machine>(machine: M, from: StatusOf<M>, to: StatusOf<M>, message?: string): void {
  if (!canTransition(machine, from, to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      message ?? `${NAMES[machine]} joriy holatda bu amalni bajarib bo‘lmaydi.`,
    );
  }
}

/** Berilgan holatlardan `to` ga o'tish mumkin bo'lganlari (shartli updateMany uchun). */
export function sourcesFor<M extends Machine>(machine: M, to: StatusOf<M>): StatusOf<M>[] {
  const table = TABLES[machine] as Table<string>;
  return Object.keys(table).filter((from) => (table[from] ?? []).includes(to)) as StatusOf<M>[];
}
