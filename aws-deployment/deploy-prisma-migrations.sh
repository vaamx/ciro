#!/bin/bash
# Script to deploy both Prisma and TypeScript migrations to AWS RDS

# Exit on error
set -e

# Load AWS configuration
if [ ! -f aws-config.env ]; then
    echo "aws-config.env not found. Run setup-aws-resources.sh and create-rds.sh first."
    exit 1
fi

source aws-config.env

echo "=== Deploying Migrations to AWS RDS ==="
echo "RDS endpoint: $RDS_ENDPOINT"
echo "Database: $RDS_DB_NAME"
echo "Username: $RDS_USERNAME"

# Create a temporary .env file for migrations
echo "Setting up temporary environment for migrations..."
TMP_ENV_FILE=".env.migration-deploy"

cat > $TMP_ENV_FILE << EOF
DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public"
NODE_ENV="production"
EOF

# Make sure we have the required files
echo "Verifying required files..."

if [ ! -f "../prisma/schema.prisma" ]; then
    echo "Error: Prisma schema not found at ../prisma/schema.prisma"
    rm $TMP_ENV_FILE
    exit 1
fi

if [ ! -f "../dist/infrastructure/database/run-migrations.js" ]; then
    echo "Error: Compiled migration runner not found at ../dist/infrastructure/database/run-migrations.js"
    echo "Make sure to build the server before running this script (npm run build)"
    rm $TMP_ENV_FILE
    exit 1
fi

# Test the connection
echo "Testing database connection..."
DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
  npx prisma db pull --schema="../prisma/schema.prisma" --force &> /dev/null || {
    echo "Error: Could not connect to the database. Please check your AWS RDS configuration."
    echo "Make sure your security groups allow access from your current IP address."
    rm $TMP_ENV_FILE
    exit 1
}

echo "Database connection successful!"

# Run our unified migration system
echo "Running unified migration system..."
echo "This will apply both Prisma migrations and TypeScript migrations in the correct order."

# Run migrations using the runner we created
(
  cd ..
  source $PWD/aws-deployment/$TMP_ENV_FILE
  NODE_ENV=production node dist/infrastructure/database/run-migrations.js
)

# Clean up
rm $TMP_ENV_FILE

echo "Migrations deployed successfully!"
echo "Your AWS RDS database should now have all the required tables." 