# Stage 1: Build stage with all dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Stage 2: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 vcp
USER vcp

# Copy node_modules from builder stage (includes tsx for runtime)
COPY --from=builder --chown=vcp:nodejs /app/node_modules ./node_modules

# Copy source files from builder stage
COPY --from=builder --chown=vcp:nodejs /app/src ./src
COPY --from=builder --chown=vcp:nodejs /app/index_16.ts ./
COPY --from=builder --chown=vcp:nodejs /app/index_201.ts ./
COPY --from=builder --chown=vcp:nodejs /app/index_21.ts ./
COPY --from=builder --chown=vcp:nodejs /app/package.json ./

# Environment variables
ENV ENTRY_POINT=index_16.ts
ENV ADMIN_PORT=9999

# Expose admin API port
EXPOSE 9999

# Run the application
CMD ["sh", "-c", "npx tsx ${ENTRY_POINT}"]
