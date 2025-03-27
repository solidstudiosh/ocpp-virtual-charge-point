FROM node:20.18-alpine AS builder-stage

WORKDIR /app

# Copy package files first and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Then copy the rest of your application
COPY . .

# If you still need npm and tsx globally
RUN npm install -g npm@10.9.0 && \
    npm install -g tsx@4.19.1

ENTRYPOINT ["npx", "tsx", "index_16.ts"]