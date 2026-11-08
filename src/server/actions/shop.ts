"use server";

import type { ActionResult, CreatePickupRequestInput, DisputeStatus } from "@/server/contract";
import * as svc from "@/server/services/shop";
import { withActor } from "./_run";

export async function createPickupRequest(input: CreatePickupRequestInput): Promise<ActionResult<{ requestId: string }>> {
  return withActor(["shop", "operator"], (a) => svc.createPickupRequest(a, input));
}

export async function cancelPickupRequest(input: { requestId: string; reason?: string }): Promise<ActionResult> {
  return withActor(["shop", "operator"], (a) => svc.cancelPickupRequest(a, input));
}

export async function confirmStopWeight(input: { stopId: string }): Promise<ActionResult> {
  return withActor(["shop", "operator", "collector"], (a) => svc.confirmStopWeight(a, input));
}

export async function disputeStopWeight(input: { stopId: string; reason: string; claimedKg?: string }): Promise<ActionResult<{ disputeId: string }>> {
  return withActor(["shop", "operator", "collector"], (a) => svc.disputeStopWeight(a, input));
}

/** Do'kon ham, yig'uvchi ham chaqiradi (o'z tomonini belgilaydi). */
export async function acknowledgeDispute(input: { disputeId: string; agree: boolean; comment?: string }): Promise<ActionResult<{ status: DisputeStatus }>> {
  return withActor(["shop", "operator", "collector"], (a) => svc.acknowledgeDispute(a, input));
}
