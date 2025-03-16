FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY knexfile.ts ./

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"] 