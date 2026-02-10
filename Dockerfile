# ---- Base ----
FROM node:20-slim AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- Build ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production

# Copy production node_modules
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built assets from build stage
COPY --from=build /app/dist ./dist

# Copy migration files (needed for db:push at deploy time)
COPY drizzle.config.ts ./
COPY shared ./shared
COPY migrations ./migrations

# Railway injects PORT automatically
EXPOSE ${PORT:-5000}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
