# ==============================================================================
# QuizForge Frontend — Production Multi-Stage Dockerfile
# ==============================================================================

# Stage 1: Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace and package manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy shared source and frontend source
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

# Build shared package and frontend production bundle
RUN pnpm --filter @quiz-forge/shared build && pnpm --filter @quiz-forge/frontend build

# Stage 2: Nginx runtime stage
FROM nginx:1.27-alpine AS runner

# Remove default nginx site config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration with SPA routing and API reverse proxy
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets from builder stage
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
