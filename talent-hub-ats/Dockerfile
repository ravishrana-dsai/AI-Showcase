# ===========================================
# Talent Hub - Multi-stage Docker build
# ===========================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
# Install without running postinstall (we'll generate Prisma client in builder)
RUN npm ci --ignore-scripts

# ---- Builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (needs the schema and engine binaries)
RUN npx prisma@5.22.0 generate --schema=packages/db/prisma/schema.prisma

# Build only the web app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build --workspace=apps/web

# ---- Runner ----
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone Next.js output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy Prisma schema and generated client for migrations
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# The standalone server entry point Next.js generates
USER nextjs

EXPOSE 3050
ENV PORT=3050
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
