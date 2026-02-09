# Stage 1: Prune monorepo to only web app and its workspace dependencies
FROM node:22-alpine AS pruner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install -g turbo@^2
WORKDIR /app
COPY . .
RUN turbo prune web --docker

# Stage 2: Install dependencies (cached layer)
FROM node:22-alpine AS installer
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo build --filter=web

# Stage 4: Production runner (~150MB)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 2000
ENV PORT=2000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
