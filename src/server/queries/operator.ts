// Operator so'rovlari (faqat server).
import "server-only";
import { notFound } from "next/navigation";
import type {
  AuditDTO,
  OperatorDashboardCounts,
  OperatorDirectory,
  OperatorQueue,
  QueueFilters,
  TripBuilderOptions,
  TripDetail,
  TripListItem,
  TripStatus,
} from "@/server/contract";
import {
  loadAudit,
  loadDirectory,
  loadOperatorCounts,
  loadQueue,
  loadTripBuilderOptions,
  loadTripDetail,
  loadTrips,
} from "@/server/loaders/operator";
import { requireUser } from "./session";

function must<T>(v: T | null): T {
  if (v === null) notFound();
  return v;
}

export async function getOperatorCounts(): Promise<OperatorDashboardCounts> {
  return must(await loadOperatorCounts(await requireUser("OPERATOR")));
}

export async function getQueue(filters: QueueFilters): Promise<OperatorQueue> {
  return must(await loadQueue(await requireUser("OPERATOR"), filters));
}

export async function getTripBuilderOptions(requestIds: string[]): Promise<TripBuilderOptions> {
  return must(await loadTripBuilderOptions(await requireUser("OPERATOR"), requestIds));
}

export async function getTrips(filter: { status?: TripStatus | "ACTIVE" | "ALL" }): Promise<TripListItem[]> {
  return must(await loadTrips(await requireUser("OPERATOR"), filter));
}

export async function getTripDetail(id: string): Promise<TripDetail> {
  return must(await loadTripDetail(await requireUser("OPERATOR"), id));
}

export async function getDirectory(): Promise<OperatorDirectory> {
  return must(await loadDirectory(await requireUser("OPERATOR")));
}

export async function getAudit(filter: { tripId?: string; limit?: number }): Promise<AuditDTO[]> {
  return must(await loadAudit(await requireUser("OPERATOR"), filter));
}
