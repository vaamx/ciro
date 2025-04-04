#!/bin/bash
# Script to deploy Prisma migrations to AWS RDS

# Exit on error
set -e

# Load AWS configuration
if [ ! -f aws-config.env ]; then
    echo "aws-config.env not found. Run setup-aws-resources.sh and create-rds.sh first."
    exit 1
fi

source aws-config.env

echo "=== Deploying Prisma Migrations to AWS RDS ==="
echo "RDS endpoint: $RDS_ENDPOINT"
echo "Database: $RDS_DB_NAME"
echo "Username: $RDS_USERNAME"

# Create a temporary .env file for Prisma
echo "Setting up temporary environment for Prisma..."
TMP_ENV_FILE=".env.prisma-deploy"

cat > $TMP_ENV_FILE << EOF
DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public"
EOF

# Make sure we're working with the right schema
echo "Verifying Prisma schema..."
if [ ! -f "../prisma/schema.prisma" ]; then
    echo "Error: Prisma schema not found at ../prisma/schema.prisma"
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

# Deploy migrations
echo "Deploying Prisma migrations..."
DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
  npx prisma migrate deploy --schema="../prisma/schema.prisma"

# Clean up
rm $TMP_ENV_FILE

echo "Migrations deployed successfully!"
echo "Your AWS RDS database should now have all the required tables." 