// Do'kon so'rovlari (faqat server).
import "server-only";
import { notFound } from "next/navigation";
import type { ShopHistory, ShopHome, ShopRequestDetail } from "@/server/contract";
import { loadShopHistory, loadShopHome, loadShopRequest } from "@/server/loaders/shop";
import { requireUser } from "./session";

export async function getShopHome(): Promise<ShopHome> {
  const user = await requireUser("SHOP");
  const data = await loadShopHome(user);
  if (!data) notFound();
  return data;
}

export async function getShopRequest(id: string): Promise<ShopRequestDetail> {
  const user = await requireUser("SHOP");
  const data = await loadShopRequest(user, id);
  if (!data) notFound();
  return data;
}

export async function getShopHistory(): Promise<ShopHistory> {
  const user = await requireUser("SHOP");
  const data = await loadShopHistory(user);
  if (!data) notFound();
  return data;
}
