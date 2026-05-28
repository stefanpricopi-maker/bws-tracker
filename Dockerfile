# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless lockfile changes)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build -- --config astro.config.docker.mjs


# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Only copy the production artifact and its runtime dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Drizzle migrations (run at container start if needed)
COPY --from=builder /app/drizzle ./drizzle

# Migration runner script
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs

EXPOSE 4321

# Run migrations then start the server
CMD ["sh", "-c", "node ./scripts/migrate.mjs && node ./dist/server/entry.mjs"]
