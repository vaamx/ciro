# Document Processing System Setup Guide

This guide provides comprehensive instructions for setting up the document processing system using Unstructured, LlamaIndex, and Qdrant.

## Prerequisites

- Docker and Docker Compose installed
- Node.js (version 18 or later) installed
- OpenAI API key

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
# Database settings
DB_HOST=localhost  # Use '***REMOVED***' inside Docker containers
DB_PORT=5432       # May be 5433 if local PostgreSQL is running
DB_USER=***REMOVED***
DB_PASSWORD=***REMOVED***
DB_NAME=ciro_db

# OpenAI settings
OPENAI_API_KEY=your_key_here  # Replace with your actual API key
OPENAI_ORG_ID=your_org_id     # Optional

# Unstructured API settings
UNSTRUCTURED_API_URL=http://localhost:8010  # Use 'http://unstructured:8000' inside Docker

# Qdrant settings
QDRANT_URL=http://localhost:6333  # Use 'http://qdrant:6333' inside Docker
```

Then create the same `.env` file in the `server` directory.

### 3. Check for Port Conflicts

Before proceeding, check if any required ports are already in use:

- PostgreSQL: Port 5432
- Unstructured API: Port 8010
- Qdrant: Port 6333

If any of these ports are in use, you'll need to modify `docker-compose.yml` to use different ports.

### 4. Automated Setup

For an automated setup that handles common issues:

```bash
chmod +x fix-all.sh
./fix-all.sh
```

This script will:
- Check for port conflicts and offer solutions
- Update Docker Compose configuration
- Set up environment variables
- Initialize the database
- Remove any orphaned containers

### 5. Manual Setup

If you prefer manual setup:

```bash
# Install dependencies
cd server
npm install
cd ..

# Start the services
docker-compose up -d ***REMOVED*** qdrant unstructured

# Wait for services to initialize
sleep 10

# Run database migrations
cd server
PGHOST=localhost npm run migrate:latest
cd ..
```

## Running the Application

### 1. Development Mode

For development with hot-reloading:

```bash
# Start the backend server
cd server
npm run dev

# In another terminal, start the frontend
cd dashboard
npm run dev
```

### 2. Docker Compose

To run the entire application using Docker Compose:

```bash
docker-compose up
```

This will start all services including PostgreSQL, Qdrant, Unstructured, and the server.

## Troubleshooting

### Common Issues

1. **Database Connection Problems**
   - Check that PostgreSQL is running
   - Ensure you're using the correct host ('localhost' outside Docker, '***REMOVED***' inside Docker)
   - Verify the port matches your configuration

2. **Port Conflicts**
   - Use `sudo lsof -i :<port>` to check what process is using a port
   - Modify `docker-compose.yml` to use different port mappings if needed

3. **OpenAI API Issues**
   - Ensure your API key is correctly set in both root and server `.env` files
   - Check OpenAI service status if requests are failing

4. **Unstructured Processing Failures**
   - Verify Unstructured API is running (`curl http://localhost:8010/health`)
   - Check container logs: `docker logs ciro-1-unstructured-1`

### Running the Fix Scripts

If you encounter issues with the setup:

- **All issues**: `./fix-all.sh`
- **PostgreSQL issues**: `./fix-***REMOVED***.sh`
- **Unstructured issues**: `./fix-setup.sh`

## Additional Resources

- [Document Processing Architecture](DOCUMENT_PROCESSING.md)
- [Troubleshooting Guide](SETUP-FIXES.md)
- [Unstructured API Documentation](https://unstructured-io.github.io/unstructured/)
- [LlamaIndex Documentation](https://docs.llamaindex.ai/)
- [Qdrant Documentation](https://qdrant.tech/documentation/) 