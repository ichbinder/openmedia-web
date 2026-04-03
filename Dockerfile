FROM node:22-alpine AS builder

# Build-time args: BACKEND_URL is baked into next.config.ts rewrites().
# TMDB_API_KEY is needed at build for Server Components, but also at runtime.
# Keep as ARG only (not ENV) to avoid persisting secrets in layer metadata.
ARG BACKEND_URL=http://localhost:4000
ARG TMDB_API_KEY

# Fail fast if TMDB_API_KEY is missing
RUN test -n "$TMDB_API_KEY" || (echo "ERROR: TMDB_API_KEY build arg is required" && exit 1)

# Set for the build process only (not persisted in layer)
ENV BACKEND_URL=$BACKEND_URL
ENV TMDB_API_KEY=$TMDB_API_KEY

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Runtime env: TMDB_API_KEY is read by tmdb.ts at request time.
# Supplied via docker-compose environment (not baked into the image).
# BACKEND_URL is already baked into .next/routes-manifest.json from the build.
ARG TMDB_API_KEY
ENV TMDB_API_KEY=$TMDB_API_KEY

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next/
COPY --from=builder /app/public ./public/
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000
CMD ["npm", "start"]
