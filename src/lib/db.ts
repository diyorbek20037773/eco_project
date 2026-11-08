// PrismaClient singleton (dev'da hot-reload paytida ulanishlar ko'payib ketmasin).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_URL = "postgresql://ecopoint:ecopoint_local@localhost:5433/ecopoint";

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? DEFAULT_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { __ecopointPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__ecopointPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__ecopointPrisma = prisma;

export type Db = PrismaClient;
