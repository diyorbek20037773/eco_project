#!/usr/bin/env node
// `next build` (output: "standalone") dan keyin statik fayllar va public papkani standalone serverga ko'chiradi.
// Next standalone server ularni o'zi nusxalamaydi.
import { cpSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const standalone = join(root, ".next", "standalone");
if (!existsSync(standalone)) {
  console.log("standalone build topilmadi — o'tkazib yuborildi.");
  process.exit(0);
}
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) cpSync(join(root, "public"), join(standalone, "public"), { recursive: true });
console.log("standalone: .next/static va public ko'chirildi.");
