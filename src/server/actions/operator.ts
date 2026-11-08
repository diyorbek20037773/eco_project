"use server";

import type {
  ActionResult,
  AddExpenseInput,
  CloseCheck,
  CorrectionInput,
  CreateTripInput,
  RecordAcceptanceInput,
  RecordPaymentInput,
  TripStatus,
} from "@/server/contract";
import * as trips from "@/server/services/trips";
import * as catalog from "@/server/services/catalog";
import { withActor, type Section } from "./_run";

const ALL: Section[] = ["operator", "shop", "collector"];

export async function createTrip(input: CreateTripInput): Promise<ActionResult<{ tripId: string }>> {
  return withActor(ALL, (a) => trips.createTrip(a, input));
}

export async function reorderTripStops(input: { tripId: string; requestIds: string[] }): Promise<ActionResult> {
  return withActor(ALL, (a) => trips.reorderTripStops(a, input));
}

export async function cancelTrip(input: { tripId: string; reason: string }): Promise<ActionResult> {
  return withActor(ALL, (a) => trips.cancelTrip(a, input));
}

export async function decideDispute(input: { disputeId: string; decisionText: string; decidedKg: string }): Promise<ActionResult> {
  return withActor(ALL, (a) => trips.decideDispute(a, input));
}

export async function recordAcceptance(input: RecordAcceptanceInput): Promise<ActionResult<{ discrepancyGrams: number }>> {
  return withActor(ALL, (a) => trips.recordAcceptance(a, input));
}

export async function addExpense(input: AddExpenseInput): Promise<ActionResult<{ expenseId: string }>> {
  return withActor(ALL, (a) => trips.addExpense(a, input));
}

export async function recordPayment(input: RecordPaymentInput): Promise<ActionResult<{ paymentId: string; remaining: number }>> {
  return withActor(ALL, (a) => trips.recordPayment(a, input));
}

export async function closeTrip(input: { tripId: string }): Promise<ActionResult<{ status: TripStatus; failed: CloseCheck[] }>> {
  return withActor(ALL, (a) => trips.closeTrip(a, input));
}

export async function correctRecord(input: CorrectionInput): Promise<ActionResult> {
  return withActor(ALL, (a) => trips.correctRecord(a, input));
}

export async function createShop(input: {
  name: string;
  contactName?: string;
  phone?: string;
  point: { name: string; address: string; district: string; landmark?: string; contactName?: string; contactPhone: string };
  user?: { login: string; name: string; password: string };
}): Promise<ActionResult<{ shopId: string }>> {
  return withActor(["operator"], (a) => catalog.createShop(a, input));
}

export async function addPoint(input: {
  shopId: string;
  name: string;
  address: string;
  district: string;
  landmark?: string;
  contactName?: string;
  contactPhone: string;
}): Promise<ActionResult<{ pointId: string }>> {
  return withActor(["operator", "shop"], (a) => catalog.addPoint(a, input));
}

export async function addShopUser(input: { shopId: string; login: string; name: string; password: string }): Promise<ActionResult<{ userId: string }>> {
  return withActor(["operator"], (a) => catalog.addShopUser(a, input));
}

export async function createCollector(input: { name: string; phone: string; login: string; password: string }): Promise<ActionResult<{ userId: string }>> {
  return withActor(["operator"], (a) => catalog.createCollector(a, input));
}

export async function createBuyer(input: {
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  qualityTerms: string;
  minBatchKg: string;
}): Promise<ActionResult<{ buyerId: string }>> {
  return withActor(["operator"], (a) => catalog.createBuyer(a, input));
}

export async function updateBuyer(input: {
  buyerId: string;
  contactName?: string;
  phone?: string;
  address?: string;
  qualityTerms: string;
  minBatchKg: string;
  isActive: boolean;
}): Promise<ActionResult> {
  return withActor(["operator"], (a) => catalog.updateBuyer(a, input));
}

export async function createTariff(input: { shopPricePerKg: number; buyerPricePerKg: number; serviceFee: number; note?: string }): Promise<ActionResult<{ tariffId: string }>> {
  return withActor(["operator"], (a) => catalog.createTariff(a, input));
}
