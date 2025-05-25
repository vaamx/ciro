# Base image with Python 3.11
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Create a non-root user for security
RUN useradd --create-home --shell /bin/bash --uid 1000 sandbox_user

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create directories
RUN mkdir -p /scratch /app/logs
RUN chown -R sandbox_user:sandbox_user /scratch /app

# Copy the FastAPI application
COPY main.py .

# Switch to non-root user
USER sandbox_user

# Create scratch directory for user
RUN mkdir -p /scratch

# Expose port for FastAPI
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

# Run the FastAPI application
CMD ["python", "main.py"] 