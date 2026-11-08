"use server";

import type { ActionResult, RecordWeighingInput } from "@/server/contract";
import * as svc from "@/server/services/collector";
import { withActor } from "./_run";

export async function recordWeighing(input: RecordWeighingInput): Promise<ActionResult<{ netGrams: number; nextStopId: string | null }>> {
  return withActor(["collector", "shop", "operator"], (a) => svc.recordWeighing(a, input));
}

export async function skipStop(input: { stopId: string; reason: string }): Promise<ActionResult<{ nextStopId: string | null }>> {
  return withActor(["collector", "shop", "operator"], (a) => svc.skipStop(a, input));
}
