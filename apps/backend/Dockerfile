# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Docker CLI for infrastructure control actions (compose restart via mounted socket)
RUN apk add --no-cache docker-cli docker-cli-compose

# Create non-root user; add to docker group for socket access (GID must match host via compose group_add)
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 exchange \
 && addgroup -S -g 999 docker 2>/dev/null || addgroup -S docker \
 && adduser exchange docker 2>/dev/null || true

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev && npm cache clean --force

# Create logs directory
RUN mkdir -p logs && chown -R exchange:nodejs logs

# Switch to non-root user
USER exchange

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/health/live || exit 1

# Start application
CMD ["node", "dist/server.js"]
