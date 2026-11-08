// DB testlari oldidan izolyatsiyalangan test bazasini tayyorlaydi — faqat TEST_DATABASE_URL (ish bazasi emas).
// scripts/reset-test-db.mjs: migrate deploy + barcha jadvallarni TRUNCATE (faqat "*_test" nomli bazada).
import "dotenv/config";
import { spawnSync } from "node:child_process";
import path from "node:path";

export default function setup(): void {
  const root = path.resolve(import.meta.dirname, "..", "..");
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "reset-test-db.mjs")], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`Test bazasini tayyorlab bo'lmadi:\n${r.stdout}\n${r.stderr}`);
}
