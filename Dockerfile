FROM node:current-alpine3.21
LABEL authors="mobility"

# Set working directory
WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the project
COPY . .

# Expose admin API port
EXPOSE 9999

# Run the TypeScript entrypoint with tsx
ENTRYPOINT ["npx", "tsx", "stationAPIServer.ts"]