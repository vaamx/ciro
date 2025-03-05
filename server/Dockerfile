FROM node:18-alpine

WORKDIR /app

# Install dependencies for building native modules and sharp
RUN apk add --no-cache python3 make g++ git vips-dev \
    # Add Tesseract OCR and Poppler Utils for image-based PDF processing
    tesseract-ocr \
    poppler-utils \
    # Create tessdata directory and download English language data
    && mkdir -p /usr/share/tessdata \
    && wget -O /usr/share/tessdata/eng.traineddata https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata \
    # Verify installations
    && tesseract --version \
    && pdftoppm -v

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps && \
    # Install platform-specific sharp
    npm install --platform=linuxmusl --arch=x64 sharp && \
    # Create directories for PDF.js resources
    mkdir -p node_modules/pdfjs-dist/standard_fonts && \
    mkdir -p node_modules/pdfjs-dist/cmaps && \
    # Verify PDF.js installation
    ls -la node_modules/pdfjs-dist/build/

# Copy application code and migrations
COPY src/ src/
COPY migrations/ migrations/
COPY tsconfig.json ./
COPY .env* ./

# Create directories for uploads, logs, and migrations
RUN mkdir -p uploads logs migrations

# Create an entrypoint script with unix line endings
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'echo "Running database migrations..."' >> /app/docker-entrypoint.sh && \
    echo 'npm run migrate || echo "Migration command failed but continuing startup"' >> /app/docker-entrypoint.sh && \
    echo 'echo "Starting server..."' >> /app/docker-entrypoint.sh && \
    echo 'exec "$@"' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

# Build TypeScript files
RUN npm run build || echo "Build failed, but continuing as we're using ts-node in dev mode"

# Expose the port
EXPOSE 3001

# Set default environment variables
ENV NODE_ENV=development
ENV DB_HOST=***REMOVED***
ENV DB_PORT=5432
ENV DB_USER=***REMOVED***
ENV DB_PASSWORD=***REMOVED***
ENV DB_NAME=ciro_db
ENV IN_DOCKER=true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O - http://0.0.0.0:3001/health || exit 1

# Set the entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Command for development (using nodemon)
CMD ["npm", "run", "dev"]

# For production, you would use: CMD ["node", "dist/index.js"] 