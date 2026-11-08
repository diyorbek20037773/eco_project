// Demo akkauntlar (faqat mahalliy seed; production'da kira olmaydi). docs/contract.md §7.
import type { DemoAccount, Role } from "@/server/contract";

export const DEMO_PASSWORD = "EcoDemo2026!";

export interface DemoUserSeed {
  login: string;
  name: string;
  role: Role;
  phone: string | null;
  shopKey: "dokon1" | "dokon2" | "dokon3" | null;
  label: string;
}

export const DEMO_USERS: readonly DemoUserSeed[] = [
  { login: "operator", name: "Eco Point operatori", role: "OPERATOR", phone: "+998 90 000 00 01", shopKey: null, label: "Operator — Eco Point" },
  { login: "dokon1", name: "Dilnoza", role: "SHOP", phone: "+998 90 000 00 11", shopKey: "dokon1", label: "Do‘kon xodimi — Nur market" },
  { login: "dokon2", name: "Sardor", role: "SHOP", phone: "+998 90 000 00 12", shopKey: "dokon2", label: "Do‘kon xodimi — Bahor savdo (boshqa do‘kon)" },
  { login: "dokon3", name: "Malika", role: "SHOP", phone: "+998 90 000 00 13", shopKey: "dokon3", label: "Do‘kon xodimi — Oila supermarketi" },
  { login: "yiguvchi1", name: "Akmal", role: "COLLECTOR", phone: "+998 90 000 00 21", shopKey: null, label: "Hamkor yig‘uvchi — Akmal" },
  { login: "yiguvchi2", name: "Bekzod", role: "COLLECTOR", phone: "+998 90 000 00 22", shopKey: null, label: "Hamkor yig‘uvchi — Bekzod" },
];

export function demoAccounts(): DemoAccount[] {
  return DEMO_USERS.map((u) => ({ login: u.login, password: DEMO_PASSWORD, role: u.role, label: u.label }));
}
