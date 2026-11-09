// PrismaClient singleton (dev'da hot-reload paytida ulanishlar ko'payib ketmasin).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_URL = "postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint";

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? DEFAULT_URL;
  // Kichik pilot uchun ixcham hovuz: kam ulanish = DB va ilova xotirasi kamroq.
  // Bo'sh ulanishlar 10 soniyadan keyin yopiladi (Railway'da bo'sh turganda resurs yemaydi).
  const adapter = new PrismaPg({
    connectionString,
    max: intEnv("DATABASE_POOL_MAX", 5),
    idleTimeoutMillis: intEnv("DATABASE_IDLE_TIMEOUT_MS", 10_000),
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __ecopointPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__ecopointPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__ecopointPrisma = prisma;

export type Db = PrismaClient;
