# syntax=docker/dockerfile:1
# Build & runtime image for the @paws/server Colyseus process.
# Built from the repo root so the workspace context is available.
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate

# --- deps: install workspace dependencies (server + shared subtree) ---
FROM base AS deps
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
# --ignore-scripts so `prepare` (which builds shared) doesn't run before sources are copied.
RUN pnpm install --frozen-lockfile --ignore-scripts \
    --filter @paws/server... --filter @paws/shared

# --- build: compile shared, then server ---
FROM deps AS build
WORKDIR /repo
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
RUN pnpm --filter @paws/shared build \
 && pnpm --filter @paws/server build

# --- runtime: prod deps + compiled output only ---
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --prod --frozen-lockfile --ignore-scripts \
    --filter @paws/server... --filter @paws/shared

COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/apps/server/dist ./apps/server/dist

EXPOSE 2567
CMD ["node", "apps/server/dist/index.js"]
