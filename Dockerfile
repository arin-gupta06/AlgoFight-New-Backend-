# Multi-stage / optimized Dockerfile for AlgoFight Monorepo
FROM node:20-bookworm-slim AS base

WORKDIR /app

# Install system dependencies needed for Prisma engines, SSL certificates, and network health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm matching repo version
RUN npm install -g pnpm@11.4.0

# -------------------------------------------------------------
# Dependency cache layer
# -------------------------------------------------------------
FROM base AS dependencies

# Copy root workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy all package.json files across apps and packages for efficient layer caching
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY apps/websocket/package.json ./apps/websocket/
COPY apps/scheduler/package.json ./apps/scheduler/

COPY packages/application/package.json ./packages/application/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/error_handling/package.json ./packages/error_handling/
COPY packages/events/package.json ./packages/events/
COPY packages/institutional-identity/package.json ./packages/institutional-identity/
COPY packages/logger/package.json ./packages/logger/
COPY packages/queue/package.json ./packages/queue/
COPY packages/state-machine/package.json ./packages/state-machine/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/types/package.json ./packages/types/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# -------------------------------------------------------------
# Build & Generation layer
# -------------------------------------------------------------
FROM dependencies AS builder

# Copy all application and package sources
COPY tsconfig.base.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

# Generate Prisma Client for PostgreSQL
RUN pnpm --filter @algofight/database exec prisma generate

# -------------------------------------------------------------
# Production Runner
# -------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"

COPY --from=builder /app /app

EXPOSE 3000 4001

CMD ["pnpm", "--filter", "@algofight/api", "exec", "tsx", "src/index.ts"]
