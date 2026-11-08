// Yig'uvchi so'rovlari (faqat server).
import "server-only";
import { notFound } from "next/navigation";
import type { CollectorStopDetail, CollectorToday, CollectorTripDetail } from "@/server/contract";
import { loadCollectorStop, loadCollectorToday, loadCollectorTrip } from "@/server/loaders/collector";
import { requireUser } from "./session";

export async function getCollectorToday(): Promise<CollectorToday> {
  const user = await requireUser("COLLECTOR");
  const data = await loadCollectorToday(user);
  if (!data) notFound();
  return data;
}

export async function getCollectorTrip(id: string): Promise<CollectorTripDetail> {
  const user = await requireUser("COLLECTOR");
  const data = await loadCollectorTrip(user, id);
  if (!data) notFound();
  return data;
}

export async function getCollectorStop(stopId: string): Promise<CollectorStopDetail> {
  const user = await requireUser("COLLECTOR");
  const data = await loadCollectorStop(user, stopId);
  if (!data) notFound();
  return data;
}
