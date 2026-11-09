import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export default function config(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    // Yengil production server: build paytida .next/standalone yaratiladi (Railway'da
    // `node .next/standalone/server.js` — npm va to'liq next CLI'siz, kamroq xotira).
    // Faqat build bosqichida: dev rejimida standalone Fast Refresh'ni cheksiz qayta yuklashga olib keladi.
    output: phase === PHASE_PRODUCTION_BUILD ? "standalone" : undefined,
    serverExternalPackages: ["pg", "@prisma/adapter-pg"],
    // next/image ishlatilmaydi; rasmlar /api/files orqali ruxsat bilan beriladi — sharp kerak emas.
    images: { unoptimized: true },
    experimental: {
      serverActions: { bodySizeLimit: "8mb" },
    },
  };
}
