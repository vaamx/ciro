FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with development dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY knexfile.ts ./
COPY scripts/ ./scripts/
COPY jest.config.js ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files for production install
COPY package*.json ./
COPY tsconfig.json ./

# Install only production dependencies
RUN npm install --only=production --legacy-peer-deps

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY migrations/ ./migrations/
COPY knexfile.ts ./

# Create uploads directory
RUN mkdir -p uploads

# Expose the application port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV IN_DOCKER=true

# Start the application
CMD ["node", "dist/index.js"]
