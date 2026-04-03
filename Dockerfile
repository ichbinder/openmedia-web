FROM node:22-alpine AS builder

# Build-time args only — not promoted to ENV to avoid persisting secrets in layers.
# BACKEND_URL is baked into next.config.ts rewrites() during build.
# TMDB_API_KEY is needed by Server Components at build time AND at runtime.
ARG BACKEND_URL=http://localhost:4000
ARG TMDB_API_KEY

# Fail fast if TMDB_API_KEY is missing
RUN test -n "$TMDB_API_KEY" || (echo "ERROR: TMDB_API_KEY build arg is required" && exit 1)

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Pass secrets inline to avoid ENV persistence in layer metadata.
# BACKEND_URL is safe to set as ENV (not a secret), needed by next.config.ts.
ENV BACKEND_URL=$BACKEND_URL
RUN TMDB_API_KEY="$TMDB_API_KEY" npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# TMDB_API_KEY is NOT baked into the image.
# It must be supplied at runtime via docker-compose environment: block.

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next/
COPY --from=builder /app/public ./public/
COPY --from=builder /app/next.config.ts ./

EXPOSE 3000
CMD ["npm", "start"]
