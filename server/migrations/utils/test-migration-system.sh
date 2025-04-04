#!/bin/bash
# Script to test the migration system in a development environment

# Set error handling
set -e

# Determine the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"

# Change to the project root
cd "$PROJECT_ROOT"

echo "=== Testing Migration System in Development Environment ==="
echo "Project root: $PROJECT_ROOT"

# Check if .env file exists, create one if it doesn't
if [ ! -f .env ]; then
  echo "Creating .env file for testing..."
  cat > .env << EOF
# Development database connection
DATABASE_URL=***REMOVED***ql://***REMOVED***:***REMOVED***@localhost:5432/ciro_test
NODE_ENV=development
EOF
  
  echo "Created .env file with default settings."
  echo "Please edit it if you need different database credentials."
  echo ""
fi

# Check if Docker is running
echo "Checking if Docker is running..."
if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker is not running. Please start Docker and try again."
  exit 1
fi

# Ask the user if they want to use a Docker PostgreSQL container for testing
read -p "Do you want to spin up a PostgreSQL container for testing? (y/n): " USE_DOCKER_PG

if [[ "$USE_DOCKER_PG" == "y" || "$USE_DOCKER_PG" == "Y" ]]; then
  # Start a PostgreSQL container for testing
  echo "Starting PostgreSQL container for testing..."
  
  # Check if container already exists
  if docker ps -a --format '{{.Names}}' | grep -q 'ciro-migration-test-db'; then
    echo "Container ciro-migration-test-db already exists. Stopping and removing it..."
    docker stop ciro-migration-test-db > /dev/null 2>&1 || true
    docker rm ciro-migration-test-db > /dev/null 2>&1 || true
  fi
  
  # Start a new container
  docker run --name ciro-migration-test-db -e POSTGRES_PASSWORD=***REMOVED*** -e POSTGRES_USER=***REMOVED*** \
    -e POSTGRES_DB=ciro_test -p 5432:5432 -d ***REMOVED***:14
  
  echo "Waiting for PostgreSQL to start..."
  sleep 5
  
  # Update the .env file with the correct connection string
  sed -i 's|DATABASE_URL=.*|DATABASE_URL=***REMOVED***ql://***REMOVED***:***REMOVED***@localhost:5432/ciro_test|g' .env
fi

# Load environment variables
source .env

# Check if the database exists and is accessible
echo "Testing database connection..."
PGPASSWORD=***REMOVED*** psql -h localhost -U ***REMOVED*** -d ciro_test -c "SELECT 1" > /dev/null 2>&1 || {
  echo "Error: Could not connect to the database. Please check your PostgreSQL configuration."
  if [[ "$USE_DOCKER_PG" == "y" || "$USE_DOCKER_PG" == "Y" ]]; then
    echo "Docker container logs:"
    docker logs ciro-migration-test-db
  fi
  exit 1
}

echo "Database connection successful!"

# Run migration consolidation
echo -e "\n=== Step 1: Running migration consolidation ==="
echo "This step will create a Prisma migration to mark the consolidation point."
npm run migrate:consolidate

# Run TypeScript migrations
echo -e "\n=== Step 2: Running TypeScript migrations ==="
echo "This step will run all TypeScript migrations."
npm run migrate

# Check if Prisma migrations table exists
echo -e "\n=== Step 3: Verifying Prisma migrations ==="
PGPASSWORD=***REMOVED*** psql -h localhost -U ***REMOVED*** -d ciro_test -c "SELECT * FROM _prisma_migrations LIMIT 5" || {
  echo "Error: Prisma migrations table not found. The migration process did not complete successfully."
  exit 1
}

# Check if regular migrations table exists
echo -e "\n=== Step 4: Verifying TypeScript migrations ==="
PGPASSWORD=***REMOVED*** psql -h localhost -U ***REMOVED*** -d ciro_test -c "SELECT * FROM migrations LIMIT 5" || {
  echo "Error: Migrations table not found. The migration process did not complete successfully."
  exit 1
}

echo -e "\n=== Migration System Test Completed Successfully! ==="
echo "Both Prisma migrations and TypeScript migrations have been applied."

# Ask if user wants to clean up
if [[ "$USE_DOCKER_PG" == "y" || "$USE_DOCKER_PG" == "Y" ]]; then
  read -p "Do you want to stop and remove the test database container? (y/n): " CLEANUP_DOCKER
  
  if [[ "$CLEANUP_DOCKER" == "y" || "$CLEANUP_DOCKER" == "Y" ]]; then
    echo "Stopping and removing the test database container..."
    docker stop ciro-migration-test-db > /dev/null 2>&1
    docker rm ciro-migration-test-db > /dev/null 2>&1
    echo "Test container removed."
  else
    echo "Leaving the test database container running."
    echo "You can stop it later with: docker stop ciro-migration-test-db"
    echo "And remove it with: docker rm ciro-migration-test-db"
  fi
fi

echo -e "\n=== Next Steps ==="
echo "1. Review the migration files created in the prisma/migrations directory"
echo "2. Commit your changes to version control"
echo "3. Deploy to production using the updated migration scripts"
echo "   - aws-deployment/deploy-migrations-ssm.sh"
echo "   - aws-deployment/deploy-prisma-migrations.sh" 