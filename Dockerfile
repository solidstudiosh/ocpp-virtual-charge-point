# Stage 1: Build the application
FROM 350769034865.dkr.ecr.eu-west-1.amazonaws.com/empact/node-20-alpine:latest AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
#RUN npm ci --only=production

# Copy the rest of the app and build
COPY .env .env 
COPY . .
RUN npm install
RUN npm run build

# Stage 2: Run the application
FROM 350769034865.dkr.ecr.eu-west-1.amazonaws.com/empact/node-20-alpine:latest

WORKDIR /app

# Copy built files from builder stage
COPY --from=builder /app ./

# Set environment variables
# ENV NODE_ENV=production
# ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the Next.js application
CMD ["npm", "run", "start"]