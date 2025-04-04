FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with legacy-peer-deps to resolve conflicts
RUN npm install --legacy-peer-deps

# Copy source code
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY knexfile.ts ./
COPY start.js ./

# Build the application
RUN npm run build

# Debug: Check what was built
RUN find /app/dist -type f -name "*.js" | grep -v "\.map$" | sort

# Expose the application port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production

# Use our starter script which handles path resolution
CMD ["node", "start.js"]
