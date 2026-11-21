# ==============================================================================
# QuizForge Backend — Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace and package files for efficient layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy shared source and backend source
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

# Build shared package and backend application
RUN pnpm --filter @quiz-forge/shared build && pnpm --filter @quiz-forge/backend build

# Ensure migrations are bundled into dist
RUN node -e "import('node:fs').then(f => f.cpSync('apps/backend/src/db/migrations', 'apps/backend/dist/db/migrations', { recursive: true }))"

# Stage 2: Production runtime stage
FROM node:22-slim AS runner

WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV DATABASE_URL=/app/data/quizforge.db

# Create volume mount directory for SQLite persistent database
RUN mkdir -p /app/data && chown -R node:node /app

# Copy built application and production dependencies from builder
COPY --from=builder --chown=node:node /app/apps/backend/dist ./dist
COPY --from=builder --chown=node:node /app/apps/backend/package.json ./package.json
COPY --from=builder --chown=node:node /app/packages/shared/dist ./node_modules/@quiz-forge/shared/dist
COPY --from=builder --chown=node:node /app/packages/shared/package.json ./node_modules/@quiz-forge/shared/package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

USER node

EXPOSE 4000

# Health check using Node.js fetch against the health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
