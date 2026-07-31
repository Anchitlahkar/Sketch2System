# Container image for Cloud Run (or any container host).
#
# The Express server in server.ts is already Cloud-Run-shaped: it reads PORT from the
# environment, binds 0.0.0.0, and enables trust-proxy automatically when K_SERVICE is
# present. Nothing platform-specific is needed beyond this file.

FROM node:22-alpine AS build
WORKDIR /app

# Install with the lockfile first so this layer caches across source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only — the server bundle is built with --packages=external,
# so it resolves express, dotenv and @google/genai at runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Cloud Run injects PORT; this default only matters when running the image locally.
ENV PORT=8080
EXPOSE 8080

# Run unprivileged.
USER node

CMD ["node", "dist/server.cjs"]
