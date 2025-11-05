# F1 Dashboard Backend - Hono.js
# Multi-stage build for production

FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source code
FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .

# Production image
FROM base AS production
ENV NODE_ENV=production

COPY --from=install /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Expose ports
EXPOSE 4000 4001 4002

# Start all services
CMD ["bun", "start"]
