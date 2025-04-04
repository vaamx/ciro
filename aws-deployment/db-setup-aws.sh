#!/bin/bash
# Script to setup the database in AWS RDS using Prisma
# This script is useful when you need to manually seed or setup the database without deploying the full app

# Exit on error
set -e

# Check if the AWS config exists
if [ ! -f aws-config.env ]; then
    echo "aws-config.env not found. Run setup-aws-resources.sh and create-rds.sh first."
    exit 1
fi

# Load AWS configuration
source aws-config.env

echo "=== AWS RDS Database Setup ==="
echo "RDS endpoint: $RDS_ENDPOINT"
echo "Database: $RDS_DB_NAME"
echo "Username: $RDS_USERNAME"

# Create a temporary .env file for Prisma
echo "Setting up temporary environment for Prisma..."
TMP_ENV_FILE=".env.db-setup"

cat > $TMP_ENV_FILE << EOF
DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public"
EOF

# Display options to the user
echo
echo "Available database operations:"
echo "1. Deploy Prisma migrations"
echo "2. Reset database (CAUTION: This will delete all data)"
echo "3. Push schema without migrations (development only)"
echo "4. Pull current schema from database"
echo "5. Generate SQL migration script"
echo "6. Run database seed script"
echo "q. Quit"
echo

read -p "Enter your choice: " choice

case $choice in
    1)
        echo "Deploying Prisma migrations..."
        DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
            npx prisma migrate deploy --schema="../prisma/schema.prisma"
        ;;
    2)
        echo "WARNING: This will delete all data in the database!"
        read -p "Are you sure? (type 'yes' to confirm): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "Resetting database..."
            DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
                npx prisma migrate reset --force --schema="../prisma/schema.prisma"
        else
            echo "Database reset cancelled."
        fi
        ;;
    3)
        echo "WARNING: This is for development only and will skip migration history!"
        read -p "Are you sure? (type 'yes' to confirm): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "Pushing schema to database..."
            DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
                npx prisma db push --schema="../prisma/schema.prisma"
        else
            echo "Schema push cancelled."
        fi
        ;;
    4)
        echo "Pulling current schema from database..."
        DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
            npx prisma db pull --schema="../prisma/schema.prisma"
        ;;
    5)
        name=$(date +"%Y%m%d%H%M%S")_aws_migration
        read -p "Enter migration name [$name]: " input_name
        migration_name=${input_name:-$name}
        
        echo "Generating SQL migration script..."
        DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
            npx prisma migrate dev --name $migration_name --create-only --schema="../prisma/schema.prisma"
        
        echo "Migration script generated. Review the SQL at ../prisma/migrations/"
        ;;
    6)
        echo "Running database seed script..."
        if [ -f "../prisma/seed.ts" ]; then
            DATABASE_URL="***REMOVED***ql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}?schema=public" \
                npx ts-node ../prisma/seed.ts
        else
            echo "Error: Seed script not found at ../prisma/seed.ts"
        fi
        ;;
    q|Q)
        echo "Exiting."
        ;;
    *)
        echo "Invalid option."
        ;;
esac

# Clean up
rm $TMP_ENV_FILE

echo "Done!" 