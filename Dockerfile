# Eco Point — yengil production obrazi (Railway va boshqa Docker hostinglar uchun).
# Bosqichlar: deps (npm ci) → build (next build, standalone) → migrator (faqat Prisma CLI) → runner (kichik obraz).
# Railpack/mise kerak emas: hamma narsa Docker Hub (node:22-alpine) va npm registry’dan olinadi.

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall: prisma generate (bazaga ulanmaydi)
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .
# sharp (Next rasm optimizatsiyasi) ishlatilmaydi — standalone’dan olib tashlanadi (~27 MB).
RUN npm run build && rm -rf .next/standalone/node_modules/sharp .next/standalone/node_modules/@img

# Migratsiya uchun faqat Prisma CLI (+ check-env uchun pg va dotenv) — butun node_modules emas.
FROM node:22-alpine AS migrator
WORKDIR /m
RUN apk add --no-cache openssl \
  && npm init -y >/dev/null \
  && npm install --no-audit --no-fund --omit=dev prisma@7.10.1 dotenv@18.0.9 pg@8.23.1

FROM node:22-alpine AS runner
WORKDIR /app
# Railway volume root egaligida ulanadi — yozish uchun standart foydalanuvchi qoldiriladi.
RUN apk add --no-cache openssl && mkdir -p /data/uploads
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    STORAGE_DIR=/data/uploads
# Avval migrator modullari, ustidan standalone server (uning versiyalari ustun).
COPY --from=migrator /m/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/scripts/check-env.mjs /app/scripts/create-user.mjs ./scripts/
EXPOSE 3000
# Sozlama tekshiruvi → migratsiya → server (256 MB heap, npm qobig‘isiz).
CMD ["sh", "-c", "node scripts/check-env.mjs && node node_modules/prisma/build/index.js migrate deploy && exec node --max-old-space-size=256 server.js"]
